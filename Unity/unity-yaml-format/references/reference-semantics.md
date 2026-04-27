# Reference Semantics

Primary supporting sources:
- https://docs.unity3d.com/Manual/FormatDescription.html
- https://docs.unity3d.com/Manual/YAMLSceneExample.html
- https://docs.unity3d.com/Manual/UnityYAML.html
- https://docs.unity3d.com/ScriptReference/AssetDatabase.TryGetGUIDAndLocalFileIdentifier.html

## Local References

Local references point to another serialized object in the same text-serialized file.

Examples:

```yaml
m_GameObject: {fileID: 6}
```

```yaml
m_Component:
- 4: {fileID: 8}
- 23: {fileID: 11}
```

How to read them:

- `fileID` points to another object document whose header anchor is `&<fileID>`.
- In `--- !u!4 &8`, the local object instance ID is `8`.
- These references do not need a `guid` because the target object is already inside the same file.

## External Asset References

External references point to an object stored in another Unity asset file.

Example shape:

```yaml
{fileID: 10202, guid: 0123456789abcdef0123456789abcdef, type: 3}
```

How to read them:

- `guid` identifies the asset file.
- `fileID` identifies the local object inside that asset file.
- `type` is part of the serialized reference tuple and should be preserved when editing.
- `AssetDatabase.TryGetGUIDAndLocalFileIdentifier` can retrieve a Unity-derived `guid` and local file identifier for an object.
- Use the overloads that return `long` local IDs; Unity warns that local IDs can exceed 32 bits, especially for Prefabs.

## Meaning of `type`

When Unity serializes an asset reference, it commonly stores:

- `guid`
- `fileID`
- `type`

Practical rules:

- Do not drop `type` just because `guid` and `fileID` look correct.
- When copying or repairing an external reference, preserve all three fields unless you have a confirmed reason to change one.
- Treat `type` as reference metadata that helps Unity interpret the external reference correctly.
- If a merge conflict changes `guid`, `fileID`, or `type`, review the whole tuple together.

Values shown in official examples:

- `type: 0`
  - Appears in the YAML scene example for built-in material and mesh references with Unity's built-in all-zero GUID.
- `type: 2`
  - Used for Unity assets whose contents are text-serialized in UnityYAML.
  - A practical example is a non-built-in project `Material` or similar asset whose object data is stored in a Unity YAML file.
- `type: 3`
  - Appears in the `AssetDatabase.TryGetGUIDAndLocalFileIdentifier` example for a `MonoBehaviour` `m_Script` reference.
- Other `type` values can appear in real projects. Preserve the value from Unity-generated data unless Unity gives you a replacement tuple.

## Safe Interpretation Rules

- `{fileID: 0}` usually means a null-like Unity reference.
- `{fileID: someNumber}` by itself is usually a local in-file link.
- `{fileID: ..., guid: ..., type: ...}` should be treated as an external asset reference.
- `type: 0` and `type: 3` have official example uses; `type: 2` is common for non-built-in UnityYAML assets.
- Preserve `type` rather than inferring a replacement from memory.
- If `type` changes, treat that as a semantic reference change, not a formatting edit.
- If the reference target is unclear, inspect surrounding fields and the owning object before editing.

## Script Reference Repair

MonoBehaviour records usually include a script link shaped like:

```yaml
m_Script: {fileID: 11500000, guid: ..., type: 3}
```

Rules:

- Keep the `MonoBehaviour` object's local `fileID` separate from the `m_Script` reference `fileID`.
- Do not invent the script `guid`; derive it from the `.meta` file, Unity's AssetDatabase, or another trusted Unity-generated reference.
- When moving C# scripts to a DLL or package, replace only the script reference tuple needed to keep existing GameObjects attached.
