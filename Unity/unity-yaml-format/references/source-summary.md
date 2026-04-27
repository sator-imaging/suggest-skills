# Source Summary

Sources:
- https://unity.com/blog/engine-platform/understanding-unitys-serialization-language-yaml
- https://docs.unity3d.com/Manual/FormatDescription.html
- https://docs.unity3d.com/Manual/UnityYAML.html
- https://docs.unity3d.com/Manual/YAMLSceneExample.html
- https://docs.unity3d.com/Manual/ClassIDReference.html
- https://docs.unity3d.com/ScriptReference/AssetDatabase.TryGetGUIDAndLocalFileIdentifier.html

## Scope

Practical guidance for reading and cautiously editing Unity text-serialized files that use UnityYAML.

## Key Points

- Unity uses a custom YAML subset called UnityYAML rather than the full YAML specification.
- Unity documentation warns that UnityYAML files should not be externally produced or edited as a general workflow.
- Unity's scripting API documentation still acknowledges narrow manual edits to GUID and local file ID data in text-serialized projects, such as script migration repairs.
- UnityYAML supports mappings, plain and quoted scalars, and certain sequence forms, but not the full YAML feature set.
- Comments are not supported.
- Multi-line plain scalars must indent continuation lines more deeply than the previous line.
- UTF-8 characters are decoded only when they are part of a double-quoted scalar.
- Unsupported YAML features include chomping indicators, complex mapping keys, arbitrary tags, raw top-level block sequences, and arbitrary multi-document YAML input.
- In text-serialized scene-style files, each serialized object appears as its own document beginning with `--- !u!<classID> &<fileID>`.
- The number after `!u!` is the Unity class ID, while the number after `&` is the unique object ID within that file.
- Scene-style files must start with `%YAML 1.1` and `%TAG !u! tag:unity3d.com,2011:` to be accepted by Unity.
- A `GameObject` usually lists attached components in `m_Component`, and each component points back to its owner through `m_GameObject`.
- Unity references often appear as compact mappings such as `{fileID: 6}` for local references or `{fileID: 10202, guid: ..., type: 0}` for external asset references.
- In external asset references, `guid` identifies the asset file, `fileID` identifies the local object inside that asset, and `type` is part of the serialized reference tuple that should be preserved.
- Official examples show `type: 0` for built-in material and mesh references and `type: 3` for MonoBehaviour script references.
- In practice, `type: 2` is used for non-built-in Unity assets whose contents are text-serialized in UnityYAML, such as a project `Material` or similar asset.
- Do not treat `type` values as interchangeable.
- Floating-point values can appear in decimal or IEEE 754 hexadecimal notation; when Unity writes a hexadecimal float with a parenthesized decimal, only the hex value is parsed.
- Class ID `114` is used for `MonoBehaviour`, so script component records need special care around script linkage.

## Practical Interpretation

- Use this format for inspection, explanation, diffing, and very small targeted repairs.
- Avoid broad handwritten rewrites of scenes or prefabs.
- When manually editing, think in terms of object graphs and references rather than plain text blocks.
- Prefer Unity-derived identifiers from `AssetDatabase.TryGetGUIDAndLocalFileIdentifier` or existing serialized data when repairing external references.
