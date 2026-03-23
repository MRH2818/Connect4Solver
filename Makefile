IMGUI_DIR ?= third_party/imgui
OUT_DIR ?= dist
EMXX ?= em++

.PHONY: web web-windows serve clean

web:
	./build_web.sh

web-windows:
	powershell -ExecutionPolicy Bypass -File .\build_web.ps1

serve: web
	python3 -m http.server 8000 --directory $(OUT_DIR)

clean:
	rm -rf $(OUT_DIR)
