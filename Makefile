build:
	npm install --build-from-source

clean:
	@rm -rf ./lib/binding ./build

test: build
	./node_modules/.bin/tape test/*.test.js

.PHONY: build clean test