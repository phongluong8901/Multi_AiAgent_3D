package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// main khởi chạy ứng dụng PC Wails (cửa sổ Frameless tối giản, nhúng frontend/dist và bind App struct).
func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "GoLLM Worker",
		Width:     1200,
		Height:    780,
		MinWidth:  960,
		MinHeight: 620,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 15, B: 18, A: 1},
		Windows: &windows.Options{
			Theme: windows.Dark,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
