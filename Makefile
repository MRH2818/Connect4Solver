IMGUI_DIR ?= third_party/imgui
OUT_DIR ?= dist
EMCC ?= emcc

.PHONY: web serve clean

web:
	./build_web.sh

serve: web
	python3 -m http.server 8000 --directory $(OUT_DIR)

clean:
	rm -rf $(OUT_DIR)
