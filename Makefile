build:
	npm install --build-from-source

clean:
	@rm -rf ./lib/binding ./build

test: build
	@PATH=node_modules/mocha/bin:${PATH} mocha -R spec

.PHONY: build clean test