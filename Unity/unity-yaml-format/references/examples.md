# Bad To Good

Source basis:
- https://docs.unity3d.com/Manual/FormatDescription.html
- https://docs.unity3d.com/Manual/UnityYAML.html
- https://docs.unity3d.com/Manual/YAMLSceneExample.html
- https://docs.unity3d.com/ScriptReference/AssetDatabase.TryGetGUIDAndLocalFileIdentifier.html

- Bad: `Treat a Unity scene file as one normal YAML object.`
  Good: `Parse it as a sequence of serialized object documents beginning with --- !u!<classID> &<fileID>.`

- Bad: `Invent a brand-new UnityYAML file from scratch in an external tool.`
  Good: `Start from an existing Unity-serialized file and make only minimal justified repairs.`

- Bad: `Change a component reference without checking its owning GameObject or reverse links.`
  Good: `Map the related GameObject, component list, and back-references before editing IDs.`

- Bad: `Add comments to explain a manual patch.`
  Good: `Keep the serialized file comment-free and document the patch outside the UnityYAML file.`

- Bad: `Assume every number in a header is just another object ID.`
  Good: `Read !u!<classID> as the object type and &<fileID> as the in-file object instance ID.`

- Bad: `Copy only guid and fileID from an external reference and ignore type.`
  Good: `Preserve guid, fileID, and type as one tuple when repairing or moving an external asset reference.`

- Bad: `Treat different type values as interchangeable because guid is the same.`
  Good: `Treat a type change as a real reference change; preserve Unity-generated type values unless Unity-derived data gives the replacement tuple.`

- Bad: `Rewrite a hexadecimal float casually without checking the intended numeric value.`
  Good: `When editing a Unity-written hex float, replace it with a plain decimal value that preserves the intended number.`

- Bad: `Add non-ASCII text as an unquoted plain scalar and assume it will round-trip.`
  Good: `Use a double-quoted scalar when UTF-8 character decoding matters.`

- Bad: `Use YAML block string syntax with | or + to store long text.`
  Good: `Use UnityYAML-supported scalar forms; UnityYAML treats chomping indicators as scalar content rather than YAML controls.`

- Bad: `Use a top-level block sequence because a generic YAML parser accepts it.`
  Good: `Keep sequences as mapping values, matching UnityYAML's supported shape.`

## Inspection Patterns

- Pattern: `A GameObject document has m_Component entries like - 4: {fileID: 8}.`
  Interpretation: `The left number is a class ID hint, and the mapped fileID points to the actual component document in the same file.`

- Pattern: `A component has m_GameObject: {fileID: 6}.`
  Interpretation: `That component belongs to the GameObject whose document anchor is &6.`

- Pattern: `A reference appears as {fileID: 10202, guid: ..., type: 0}.`
  Interpretation: `This is likely an external asset reference, so preserve guid, fileID, and type together when patching.`

- Pattern: `A project material reference appears as {fileID: ..., guid: ..., type: 2}.`
  Interpretation: `This commonly points to a non-built-in UnityYAML asset; preserve the tuple and verify the target asset when repairing it.`

- Pattern: `A MonoBehaviour has m_Script: {fileID: 11500000, guid: ..., type: 3}.`
  Interpretation: `The MonoBehaviour document is class ID 114, while this field links the component to its script asset.`
