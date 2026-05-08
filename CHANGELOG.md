# Changelog

## [1.3.0](https://github.com/sator-imaging/suggest-skills/compare/v1.2.1...v1.3.0) (2026-05-08)


### Features

* **action:** update generate action ([a778c38](https://github.com/sator-imaging/suggest-skills/commit/a778c38e1c32f92eec8b37516acb0ce820d4977b))
* add --manifest-urls CLI option ([#40](https://github.com/sator-imaging/suggest-skills/issues/40)) ([6ad6b9b](https://github.com/sator-imaging/suggest-skills/commit/6ad6b9b958eb0e92999237b2c27080360cacbb09))
* add android official skills ([c622b08](https://github.com/sator-imaging/suggest-skills/commit/c622b0814568e5f9b04098bc2e6f65252b14efe4))
* add in-memory cache for fetch_manifest tool ([#91](https://github.com/sator-imaging/suggest-skills/issues/91)) ([f704352](https://github.com/sator-imaging/suggest-skills/commit/f7043523037491376cadb55883623759077fff6c))
* add link for bundled assets in `.designs.md` ([2b602b2](https://github.com/sator-imaging/suggest-skills/commit/2b602b2fe96113032df4e15dc0a1685da29678ae))
* **cmd:** Add download subcommand ([#73](https://github.com/sator-imaging/suggest-skills/issues/73)) ([d260193](https://github.com/sator-imaging/suggest-skills/commit/d2601937e80bc41b46bd5c3e99814d80cd06c196))
* collapse bundled assets display ([4ad9a06](https://github.com/sator-imaging/suggest-skills/commit/4ad9a066faa78d3792cb15fe013abc1ae8ba4e49))
* collect into curated/official folder ([3e75664](https://github.com/sator-imaging/suggest-skills/commit/3e756642cd59df5e48f3e77cebd8767c4d9ba072))
* don't collapse dir that has only a file ([e67dc99](https://github.com/sator-imaging/suggest-skills/commit/e67dc99add469729749132294f69e18617723c89))
* don't collapse root dir ([aaea871](https://github.com/sator-imaging/suggest-skills/commit/aaea871a44142306b4c400b679ef2c0633c1b62b))
* **download:** concurrent download ([b6e3eab](https://github.com/sator-imaging/suggest-skills/commit/b6e3eab3934c56d69048019a5f170640ce716727))
* front matter handling ([799a511](https://github.com/sator-imaging/suggest-skills/commit/799a51127601121dacf01d202eb1c70ec2256f2a))
* **tool:** suggest_skills now accepts an optional manifestUrl to overwrite the default configuration ([1a7c36c](https://github.com/sator-imaging/suggest-skills/commit/1a7c36c0cde1d409689d8703b235b12d4ced6367))
* Unity skills ([4c35763](https://github.com/sator-imaging/suggest-skills/commit/4c3576346e9e88f870b2d72f55646bd7d7c39073))
* **Unity:** update link ([db0abc8](https://github.com/sator-imaging/suggest-skills/commit/db0abc8657cb52fa3806249f2ae28e1fc879b21e))
* use `Bun.YAML.parse` ([615e33e](https://github.com/sator-imaging/suggest-skills/commit/615e33e2ebf13569caa490a120457b5b9aaafc8f))


### Bug Fixes

* --version and --help flags ([#62](https://github.com/sator-imaging/suggest-skills/issues/62)) ([24035f5](https://github.com/sator-imaging/suggest-skills/commit/24035f5b3be0da44da26eba0698af3af254211a3))
* action ([34a8eb1](https://github.com/sator-imaging/suggest-skills/commit/34a8eb1ea076b5aa8df10b912db8b0621b19ccae))
* **action:** address errors ([d264ace](https://github.com/sator-imaging/suggest-skills/commit/d264ace6203e9f6c41a5ce4661c9181eb121c07e))
* **action:** obsolete source ([c94b56d](https://github.com/sator-imaging/suggest-skills/commit/c94b56df0f1c936addf9947dd56d2dfaa49a8653))
* add shebang ([bbeff21](https://github.com/sator-imaging/suggest-skills/commit/bbeff21ec329698e017f5d20543e406a0f7694eb))
* DESIGN front matter handling ([089ec82](https://github.com/sator-imaging/suggest-skills/commit/089ec827c12093692bf117f0e8adb25f85f815fa))
* don't suppress errors ([a108d01](https://github.com/sator-imaging/suggest-skills/commit/a108d019099866d7b1a826149224c593807fe3af))
* generate accepts tree/REF url format ([c6f76c7](https://github.com/sator-imaging/suggest-skills/commit/c6f76c78f5ba3100994fd612cc168597c9c007b7))
* logging ([8b1da51](https://github.com/sator-imaging/suggest-skills/commit/8b1da51a3c0384358c71abb9969ad533b33601d3))
* logging ([cfbb896](https://github.com/sator-imaging/suggest-skills/commit/cfbb896048b1ce3a1c8c5ca59a65c0cdc4eae5d9))
* logging only when `-v|--version` specified ([23d2043](https://github.com/sator-imaging/suggest-skills/commit/23d20435e1b2908cd242331fd86cfc78ed0f317e))
* misdetecting utf-16 as a binary ([22db5ec](https://github.com/sator-imaging/suggest-skills/commit/22db5ecf1b96d6e08564e58219f008a104d36bcf))
* multiline YAML string ([a52443f](https://github.com/sator-imaging/suggest-skills/commit/a52443f9131d7654aad2dded3d02bd6f7943b833))
* Normalize output filenames for generate command ([#53](https://github.com/sator-imaging/suggest-skills/issues/53)) ([8e98f48](https://github.com/sator-imaging/suggest-skills/commit/8e98f4898dd6e9147d02ca67b52565b511572d5e))
* output filename and symlink handling ([ff68217](https://github.com/sator-imaging/suggest-skills/commit/ff68217a5ef5ee18a4615bdfcbd9ad20d21fd53e))
* package.json ([e4e749d](https://github.com/sator-imaging/suggest-skills/commit/e4e749d0bcca90ba85db07eb97cf8d2cdc9b8f6a))
* parse error ([fa45477](https://github.com/sator-imaging/suggest-skills/commit/fa454770ee955041aa79e22c121365f8f76f3f6a))
* push ALL.md ([19bf487](https://github.com/sator-imaging/suggest-skills/commit/19bf487e916291821c29b7acf771e7b35d9b49c6))
* Use `Bun.serve` instead of `hono` ([#69](https://github.com/sator-imaging/suggest-skills/issues/69)) ([1beb5a6](https://github.com/sator-imaging/suggest-skills/commit/1beb5a6143eaccc91eeabe3e6b61b641097a48cf))
* version and help cli flags ([#59](https://github.com/sator-imaging/suggest-skills/issues/59)) ([b5d5e7c](https://github.com/sator-imaging/suggest-skills/commit/b5d5e7c18703defc230bbd6f668fe151fc0aaa51))

## [1.2.1](https://github.com/sator-imaging/suggest-skills/compare/v1.2.0...v1.2.1) (2026-05-08)


### Bug Fixes

* refactor subcommands ([57aece6](https://github.com/sator-imaging/suggest-skills/commit/57aece67d7454e129e76509ba402fc8f746c98a9))

## [1.2.0](https://github.com/sator-imaging/suggest-skills/compare/v1.1.1...v1.2.0) (2026-05-05)


### Features

* **cmd:** Add download subcommand ([#73](https://github.com/sator-imaging/suggest-skills/issues/73)) ([d260193](https://github.com/sator-imaging/suggest-skills/commit/d2601937e80bc41b46bd5c3e99814d80cd06c196))

## [1.1.1](https://github.com/sator-imaging/suggest-skills/compare/v1.1.0...v1.1.1) (2026-05-05)


### Bug Fixes

* **action:** address errors ([d264ace](https://github.com/sator-imaging/suggest-skills/commit/d264ace6203e9f6c41a5ce4661c9181eb121c07e))
* **action:** obsolete source ([c94b56d](https://github.com/sator-imaging/suggest-skills/commit/c94b56df0f1c936addf9947dd56d2dfaa49a8653))
* logging ([8b1da51](https://github.com/sator-imaging/suggest-skills/commit/8b1da51a3c0384358c71abb9969ad533b33601d3))
* Use `Bun.serve` instead of `hono` ([#69](https://github.com/sator-imaging/suggest-skills/issues/69)) ([1beb5a6](https://github.com/sator-imaging/suggest-skills/commit/1beb5a6143eaccc91eeabe3e6b61b641097a48cf))

## [1.1.0](https://github.com/sator-imaging/suggest-skills/compare/v1.0.3...v1.1.0) (2026-05-04)


### Features

* **tool:** suggest_skills now accepts an optional manifestUrl to overwrite the default configuration ([1a7c36c](https://github.com/sator-imaging/suggest-skills/commit/1a7c36c0cde1d409689d8703b235b12d4ced6367))

## [1.0.3](https://github.com/sator-imaging/suggest-skills/compare/v1.0.2...v1.0.3) (2026-05-04)


### Bug Fixes

* --version and --help flags ([#62](https://github.com/sator-imaging/suggest-skills/issues/62)) ([24035f5](https://github.com/sator-imaging/suggest-skills/commit/24035f5b3be0da44da26eba0698af3af254211a3))

## [1.0.2](https://github.com/sator-imaging/suggest-skills/compare/v1.0.1...v1.0.2) (2026-05-04)


### Bug Fixes

* version and help cli flags ([#59](https://github.com/sator-imaging/suggest-skills/issues/59)) ([b5d5e7c](https://github.com/sator-imaging/suggest-skills/commit/b5d5e7c18703defc230bbd6f668fe151fc0aaa51))

## [1.0.1](https://github.com/sator-imaging/suggest-skills/compare/v1.0.0...v1.0.1) (2026-05-04)


### Bug Fixes

* Normalize output filenames for generate command ([#53](https://github.com/sator-imaging/suggest-skills/issues/53)) ([8e98f48](https://github.com/sator-imaging/suggest-skills/commit/8e98f4898dd6e9147d02ca67b52565b511572d5e))
