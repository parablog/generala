SHELL := /bin/bash

MESSAGE ?= chore: publish updates

.PHONY: dev publish

dev:
	npm run dev

publish:
	git add -A
	git diff --cached --quiet || git commit -m "$(MESSAGE)"
	git push
