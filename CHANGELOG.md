# Changelog

## [1.2.0](https://github.com/KRoperUK/command-code-go-pi-provider/compare/command-code-go-pi-provider-v1.1.0...command-code-go-pi-provider-v1.2.0) (2026-11-15)


### Features

* add image/vision model support ([a07366c](https://github.com/KRoperUK/command-code-go-pi-provider/commit/a07366cfe9f112af926414aa772f9a7022700154)), closes [#3](https://github.com/KRoperUK/command-code-go-pi-provider/issues/3)
* auto-sync models.json from live Command Code catalog ([3ad0610](https://github.com/KRoperUK/command-code-go-pi-provider/commit/3ad0610f21b50658fb2080986efa7f51e2e34dc4)), closes [#6](https://github.com/KRoperUK/command-code-go-pi-provider/issues/6)
* forward reasoning effort and sampling params to CC API ([e7a4f8c](https://github.com/KRoperUK/command-code-go-pi-provider/commit/e7a4f8c40f077d995f4b14e6a1891ac6d0211346)), closes [#5](https://github.com/KRoperUK/command-code-go-pi-provider/issues/5)


### Bug Fixes

* move credit stretch multipliers to credit-stretch.json ([dde90bf](https://github.com/KRoperUK/command-code-go-pi-provider/commit/dde90bfd38d0a8d82f222deb2aa636b9fa83b2db)), closes [#7](https://github.com/KRoperUK/command-code-go-pi-provider/issues/7)

## [1.1.0](https://github.com/KRoperUK/command-code-go-pi-provider/compare/command-code-go-pi-provider-v1.0.1...command-code-go-pi-provider-v1.1.0) (2026-06-22)


### Features

* initial release — Command Code API provider for Oh My Pi ([02a5dff](https://github.com/KRoperUK/command-code-go-pi-provider/commit/02a5dffb9ce162a5a7030ee624aa03f8590d4f29))


### Bug Fixes

* clamp max_tokens to CC API limit of 200K ([2bcb95a](https://github.com/KRoperUK/command-code-go-pi-provider/commit/2bcb95a8888f7245f1a7e6439f8e54c783b1a566))
* missing returns, bare block, duplicate imports; improve max_tokens, git config, project slug ([06e93c8](https://github.com/KRoperUK/command-code-go-pi-provider/commit/06e93c80126a9fbf318dbe9ff6300ed4b58fd9b8))
* update to pi-ai 16.1.15 API and fix release tarball ([9cbc79c](https://github.com/KRoperUK/command-code-go-pi-provider/commit/9cbc79cf01997044352e385dc684484b4aa5311e))

## [1.0.1](https://github.com/KRoperUK/command-code-go-pi-provider/compare/v1.0.0...v1.0.1) (2026-06-22)


### Bug Fixes

* clamp max_tokens to CC API limit of 200K ([2bcb95a](https://github.com/KRoperUK/command-code-go-pi-provider/commit/2bcb95a8888f7245f1a7e6439f8e54c783b1a566))
* missing returns, bare block, duplicate imports; improve max_tokens, git config, project slug ([06e93c8](https://github.com/KRoperUK/command-code-go-pi-provider/commit/06e93c80126a9fbf318dbe9ff6300ed4b58fd9b8))

## 1.0.0 (2026-06-15)


### Features

* initial release — Command Code API provider for Oh My Pi ([02a5dff](https://github.com/KRoperUK/command-code-go-pi-provider/commit/02a5dffb9ce162a5a7030ee624aa03f8590d4f29))
