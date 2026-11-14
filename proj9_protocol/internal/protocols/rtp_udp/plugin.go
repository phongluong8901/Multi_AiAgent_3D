package rtp_udp

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
)

const (
	udpOverhead    = 8  // UDP header
	rtpHeaderSize  = 12 // RFC 3550 fixed RTP header
	rtpVersion     = 2
	rtpPayloadType = 96
	rtpSSRC        = uint32(0x12345678)
	peerTTL        = 60 * time.Second
	maxDatagram    = 60000
)

type peer struct {
	addr *net.UDPAddr
	seen time.Time
}

// BuildRTPPacket đóng gói payload với header RTP v2 chuẩn RFC 3550 (12 byte).
func BuildRTPPacket(seq uint16, timestamp uint32, payload []byte) []byte {
	out := make([]byte, rtpHeaderSize+len(payload))
	out[0] = rtpVersion << 6
	out[1] = rtpPayloadType
	binary.BigEndian.PutUint16(out[2:4], seq)
	binary.BigEndian.PutUint32(out[4:8], timestamp)
	binary.BigEndian.PutUint32(out[8:12], rtpSSRC)
	copy(out[rtpHeaderSize:], payload)
	return out
}

// ParseRTPPacket tách header RTP v2 (12 byte) nếu datagram mang chuẩn RTP PT=96,
// ngược lại giữ nguyên payload cho UDP thô (overhead 8 byte).
func ParseRTPPacket(datagram []byte) (payload []byte, overhead int) {
	if len(datagram) >= rtpHeaderSize && (datagram[0]>>6) == rtpVersion && (datagram[1]&0x7F) == rtpPayloadType {
		return datagram[rtpHeaderSize:], udpOverhead + rtpHeaderSize
	}
	return datagram, udpOverhead
}

// RTPUDPPlugin: kênh RTP/UDP datagram (cổng chuẩn 8554/5004) hỗ trợ header RTP RFC 3550 (12B) + UDP (8B).
type RTPUDPPlugin struct {
	port     string
	mu       sync.Mutex
	conn     *net.UDPConn
	running  atomic.Bool
	peersMu  sync.Mutex
	peers    map[string]peer
	seq      atomic.Uint64
	counters core.Counters
}

func NewRTPUDPPlugin(port string) *RTPUDPPlugin {
	return &RTPUDPPlugin{port: port, peers: make(map[string]peer)}
}

func (u *RTPUDPPlugin) Name() string { return "rtp_udp" }

func (u *RTPUDPPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	addr, err := net.ResolveUDPAddr("udp", u.port)
	if err != nil {
		return err
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}
	u.mu.Lock()
	u.conn = conn
	u.mu.Unlock()
	u.running.Store(true)

	go u.readLoop(conn, inbound)
	go func() {
		<-ctx.Done()
		_ = u.Stop(context.Background())
	}()
	return nil
}

func (u *RTPUDPPlugin) readLoop(conn *net.UDPConn, inbound chan<- core.UnifiedPacket) {
	buf := make([]byte, 65535)
	for {
		n, remote, err := conn.ReadFromUDP(buf)
		if err != nil {
			return // conn đã đóng
		}
		u.peersMu.Lock()
		u.peers[remote.String()] = peer{addr: remote, seen: time.Now()}
		u.peersMu.Unlock()

		rawPayload, overhead := ParseRTPPacket(buf[:n])
		data := bytes.Clone(rawPayload)
		u.counters.In(len(data) + overhead)
		inbound <- core.UnifiedPacket{
			ID:            fmt.Sprintf("udp_%d", u.seq.Add(1)),
			SourceProto:   "rtp_udp",
			ClientID:      remote.String(),
			TopicOrRoute:  "rtp/datagram",
			Payload:       data,
			PayloadSize:   len(data),
			OverheadBytes: overhead,
			CreatedAtNano: time.Now().UnixNano(),
		}
	}
}

func (u *RTPUDPPlugin) Stop(context.Context) error {
	u.running.Store(false)
	u.mu.Lock()
	conn := u.conn
	u.conn = nil
	u.mu.Unlock()
	if conn == nil {
		return nil
	}
	return conn.Close()
}

func (u *RTPUDPPlugin) activePeers() []*net.UDPAddr {
	u.peersMu.Lock()
	defer u.peersMu.Unlock()
	out := make([]*net.UDPAddr, 0, len(u.peers))
	for key, p := range u.peers {
		if time.Since(p.seen) > peerTTL {
			delete(u.peers, key)
			continue
		}
		out = append(out, p.addr)
	}
	return out
}

func (u *RTPUDPPlugin) Send(pkt core.UnifiedPacket) error {
	u.mu.Lock()
	conn := u.conn
	u.mu.Unlock()
	if conn == nil || !u.running.Load() {
		return nil
	}
	u.counters.Latency.Observe(pkt.CalculateLatencyMs())
	data := pkt.WireJSON()
	if rtpHeaderSize+len(data) > maxDatagram {
		return fmt.Errorf("gói tin %d byte vượt giới hạn datagram", len(data))
	}
	rtpPkt := BuildRTPPacket(uint16(u.seq.Add(1)), uint32(time.Now().UnixMilli()*90), data)
	wireBytes := len(rtpPkt) + udpOverhead

	sent := 0
	for _, addr := range u.activePeers() {
		if _, err := conn.WriteToUDP(rtpPkt, addr); err == nil {
			u.counters.Out(wireBytes)
			sent++
		}
	}
	if sent == 0 {
		u.counters.Out(wireBytes)
	}
	return nil
}

func (u *RTPUDPPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	overhead := udpOverhead + rtpHeaderSize
	cp := bytes.Clone(payload)
	u.counters.In(len(cp) + overhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("udp_%d", u.seq.Add(1)),
		SourceProto:   "rtp_udp",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "rtp/datagram",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: overhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (u *RTPUDPPlugin) ResetStats() {
	u.counters.Reset()
}

func (u *RTPUDPPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "RTP/UDP Media Stream (RFC 3550)",
		Port:           u.port,
		Endpoint:       "UDP datagram (12B RTP v2 + payload)",
		Direction:      "2 chiều (không đảm bảo thứ tự)",
		IsRunning:      u.running.Load(),
		HeaderOverhead: udpOverhead + rtpHeaderSize,
	}
	u.counters.Fill(&st)
	st.ActiveClients = int64(len(u.activePeers()))
	return st
}
