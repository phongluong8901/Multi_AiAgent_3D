import os
import json
import time
import threading
import pika
from typing import Callable, Optional

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin123@localhost:5672")

def get_connection() -> Optional[pika.BlockingConnection]:
    """Tạo connection đến RabbitMQ. Trả về None nếu không kết nối được."""
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        params.socket_timeout = 5
        # LLM có thể xử lý lâu (> 60s) trong callback -> tăng heartbeat để broker không cắt kết nối
        params.heartbeat = 600
        params.blocked_connection_timeout = 300
        return pika.BlockingConnection(params)
    except Exception as e:
        print(f"[RabbitMQ] Connection failed: {e}")
        return None


def publish_event(exchange: str, routing_key: str, payload: dict) -> bool:
    """
    Publish một event JSON đến RabbitMQ exchange.
    Returns True nếu thành công, False nếu thất bại.
    """
    conn = get_connection()
    if not conn:
        return False
    try:
        channel = conn.channel()
        channel.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)
        channel.basic_publish(
            exchange=exchange,
            routing_key=routing_key,
            body=json.dumps(payload, ensure_ascii=False, default=str),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,  # persistent
            ),
        )
        return True
    except Exception as e:
        print(f"[RabbitMQ] Publish failed: {e}")
        return False
    finally:
        try:
            conn.close()
        except Exception:
            pass


def consume_events(
    exchange: str,
    routing_key: str,
    queue_name: str,
    callback: Callable[[dict], None],
    retry_delay: int = 5,
) -> None:
    """
    Khởi động consumer trong background thread.
    callback nhận dict payload từ mỗi message.
    Tự động retry kết nối khi RabbitMQ chưa sẵn sàng hoặc bị rớt kết nối.
    """
    def _run():
        while True:
            conn = get_connection()
            if not conn:
                print(f"[RabbitMQ] Consumer could not connect for queue: {queue_name}. Retry in {retry_delay}s...")
                time.sleep(retry_delay)
                continue
            try:
                channel = conn.channel()
                channel.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)
                channel.queue_declare(queue=queue_name, durable=True)
                channel.queue_bind(queue=queue_name, exchange=exchange, routing_key=routing_key)

                def on_message(ch, method, properties, body):
                    try:
                        data = json.loads(body)
                        callback(data)
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                    except Exception as e:
                        print(f"[RabbitMQ] Consumer error: {e}")
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=queue_name, on_message_callback=on_message)
                print(f"[RabbitMQ] Consumer started on queue: {queue_name}")
                channel.start_consuming()
            except Exception as e:
                print(f"[RabbitMQ] Consumer connection lost on queue {queue_name}: {e}. Reconnecting in {retry_delay}s...")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
            time.sleep(retry_delay)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
