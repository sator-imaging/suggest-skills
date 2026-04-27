# Class ID Reference

Primary source:
- https://docs.unity3d.com/Manual/ClassIDReference.html

## How To Use This File

- Use this file as a quick lookup for common IDs seen while reading `.unity`, `.prefab`, and related serialized files.
- For uncommon or version-specific classes, consult the official reference page.
- Do not assume adjacent numbers are related types; Unity class IDs are not a clean linear taxonomy.

## Common IDs

- `0`: `Object`
- `1`: `GameObject`
- `2`: `Component`
- `4`: `Transform`
- `8`: `Behaviour`
- `9`: `GameManager`
- `20`: `Camera`
- `21`: `Material`
- `23`: `MeshRenderer`
- `28`: `Texture2D`
- `29`: `OcclusionCullingSettings`
- `33`: `MeshFilter`
- `43`: `Mesh`
- `48`: `Shader`
- `54`: `Rigidbody`
- `64`: `MeshCollider`
- `65`: `BoxCollider`
- `81`: `AudioListener`
- `82`: `AudioSource`
- `83`: `AudioClip`
- `95`: `Animator`
- `104`: `RenderSettings`
- `108`: `Light`
- `114`: `MonoBehaviour`
- `115`: `MonoScript`
- `157`: `LightmapSettings`
- `196`: `NavMeshSettings`
- `198`: `ParticleSystem`
- `199`: `ParticleSystemRenderer`
- `205`: `LODGroup`
- `212`: `SpriteRenderer`
- `223`: `Canvas`
- `224`: `RectTransform`
- `225`: `CanvasGroup`

## Legacy Scene Example IDs

- Unity's YAML scene example includes legacy or example-specific records such as `--- !u!29 &1` with `Scene`, `--- !u!92` with `Behaviour`, `--- !u!124` with `Behaviour`, and `--- !u!127` with `GameManager`.
- The current class ID reference is the authority when a modern project and an old scene example disagree.
- When reviewing an old file, identify the Unity version and surrounding object fields before renaming a class ID.

## Important Notes

- The official class ID page notes that some numeric ranges are intentionally omitted because they may represent removed or reserved classes.
- `MonoBehaviour` records often combine a local object `fileID` with a script reference elsewhere in the document.
- `fileID` is not the same as `classID`. Many different objects can share the same `classID`, but each document instance has its own local `fileID`.
- Script-defined components always use class ID `114` (`MonoBehaviour`); the script identity comes from the `m_Script` reference, not from a unique class ID.
