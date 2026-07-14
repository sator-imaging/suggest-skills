# anthropics.claude-for-legal.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# anthropics.knowledge-work-plugins.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# aws.agent-toolkit-for-aws.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# google.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# GoogleChrome.modern-web-guidance.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# Kotlin.kotlin-agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [kotlin-backend-jpa-entity-mapping](https://github.com/Kotlin/kotlin-agent-skills/tree/main/skills/kotlin-backend-jpa-entity-mapping) | Model Kotlin persistence code correctly for Spring Data JPA and Hibernate. Covers entity design, identity and equality, uniqueness constraints, relationships, fetch plans, and common ORM (Object-Relational Mapping) traps specific to Kotlin. Use when creating or reviewing JPA (Java Persistence API) entities, diagnosing N+1 or LazyInitializationException, placing indexes and uniqueness rules, or preventing Kotlin-specific bugs such as data class entities and broken equals/hashCode. | None | 0 (SAFE) |
| [kotlin-tooling-agp9-migration](https://github.com/Kotlin/kotlin-agent-skills/tree/main/skills/kotlin-tooling-agp9-migration) | Migrates Kotlin Multiplatform (KMP) projects to Android Gradle Plugin 9.0+. Handles plugin replacement (com.android.kotlin.multiplatform.library), module splitting, DSL migration, and the new default project structure. Use when upgrading AGP, when build fails due to KMP+AGP incompatibility, or when the user mentions AGP 9.0, android multiplatform plugin, KMP migration, or com.android.kotlin.multiplatform.library. | `assets/checklist.md`, `references` (7 files), `scripts/analyze-project.sh` | **14 LOW** (SAFE) |
| [kotlin-tooling-cocoapods-spm-migration](https://github.com/Kotlin/kotlin-agent-skills/tree/main/skills/kotlin-tooling-cocoapods-spm-migration) | Migrate KMP projects from CocoaPods (kotlin("native.cocoapods")) to Swift Package Manager (swiftPMDependencies DSL) — replaces pod() with swiftPackage(), transforms cocoapods.* imports to swiftPMImport.*, and reconfigures the Xcode project. | `references` (5 files) | 0 (SAFE) |
| [kotlin-tooling-java-to-kotlin](https://github.com/Kotlin/kotlin-agent-skills/tree/main/skills/kotlin-tooling-java-to-kotlin) | Use when converting Java source files to idiomatic Kotlin, when user mentions "java to kotlin", "j2k", "convert java", "migrate java to kotlin", or when working with .java files that need to become .kt files. Handles framework-aware conversion for Spring, Lombok, Hibernate, Jackson, Micronaut, Quarkus, Dagger/Hilt, RxJava, JUnit, Guice, Retrofit, and Mockito. | `assets/checklist.md`, `references` (2 files), `references/frameworks` (12 files) | 0 (SAFE) |

# android.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# anthropics.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# browser-use.browser-use.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# cloudflare.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet-diag.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet-test.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# dotnet.skills.plugins.dotnet.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# facebook.react..claude.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# figma.mcp-server-guide.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# firebase.agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [firebase-ai-logic-basics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-ai-logic-basics) | Official skill for integrating Firebase AI Logic (Gemini API) into web applications. Covers setup, multimodal inference, structured output, and security. | `references` (4 files) | **10 LOW** (SAFE) |
| [firebase-app-hosting-basics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-app-hosting-basics) | Deploy and manage web apps with Firebase App Hosting. Use this skill when deploying Next.js/Angular apps with backends. | `references/cli_commands.md`, `references/configuration.md`, `references/emulation.md` | **7 LOW** (SAFE) |
| [firebase-auth-basics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-auth-basics) | Guide for setting up and using Firebase Authentication. Use this skill when the user's app requires user sign-in, user management, or secure data access using auth rules. | `references` (5 files) | **12 LOW** (SAFE) |
| [firebase-basics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-basics) | Provides foundational setup, authentication, and project management workflows for Firebase using the Firebase CLI. Use when checking Firebase CLI version (must use 'npx -y firebase-tools@latest --version'), initializing a Firebase environment, authenticating, setting active projects, or setting up `google-services.json` or `GoogleService-Info.plist` files. | `references` (7 files), `references/refresh` (4 files), `references/setup` (6 files) | **19 LOW** (SAFE) |
| [firebase-crashlytics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-crashlytics) | Comprehensive guide for Firebase Crashlytics, including provisioning and SDK usage. Use this skill when the user needs help setting up Crashlytics, adding crash reporting, or using the Crashlytics SDK in their application. | `references/android_setup.md`, `references/ios_setup.md` | **7 LOW** (SAFE) |
| [firebase-firestore](https://github.com/firebase/agent-skills/tree/main/skills/firebase-firestore) | Sets up, manages, and executes queries against Cloud Firestore database instances. You MUST unconditionally activate this skill if you plan to use Firestore in any way. Use when listing or creating Firestore databases, configuring security rules, designing data models, writing client SDK queries, or checking indexes. | `references/enterprise` (9 files), `references/standard` (7 files) | **10 LOW** (SAFE) |
| [firebase-hosting-basics](https://github.com/firebase/agent-skills/tree/main/skills/firebase-hosting-basics) | Skill for working with Firebase Hosting (Classic). Use this when you want to deploy static web apps, Single Page Apps (SPAs), or simple microservices. Do NOT use for Firebase App Hosting. | `references/configuration.md`, `references/deploying.md` | **7 LOW** (SAFE) |
| [firebase-security-rules-auditor](https://github.com/firebase/agent-skills/tree/main/skills/firebase-security-rules-auditor) | A skill to evaluate how secure Firestore security rules are. Use this when Firestore security rules are updated to ensure that the generated rules are extremely secure and robust. | None | 0 (SAFE) |
| [xcode-project-setup](https://github.com/firebase/agent-skills/tree/main/skills/xcode-project-setup) | Safely modifies Xcode projects (.pbxproj) to add Swift Packages and link files. Use this skill whenever an iOS project needs dependencies installed (e.g. Firebase, Alamofire). | `scripts/xcode_spm_setup/Package.resolved`, `scripts/xcode_spm_setup/Package.swift`, `scripts/xcode_spm_setup/Sources/main.swift` | **11 LOW** (SAFE) |

# google-gemini.gemini-cli..gemini.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# google-labs-code.stitch-skills.plugins.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# openai.skills.skills..curated.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# openai.skills.skills..system.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

# vercel-labs.agent-skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|
| [vercel-composition-patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | React composition patterns that scale. Use when refactoring components with boolean prop proliferation, building flexible component libraries, or designing reusable APIs. Triggers on tasks involving compound components, render props, context providers, or component architecture. Includes React 19 API changes. | `AGENTS.md`, `metadata.json`, `README.md`, `rules` (10 files) | **20 LOW** (SAFE) |
| [vercel-react-native-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills) | React Native and Expo best practices for building performant mobile apps. Use when building React Native components, optimizing list performance, implementing animations, or working with native modules. Triggers on tasks involving React Native, Expo, mobile performance, or native platform APIs. | `AGENTS.md`, `metadata.json`, `README.md`, `rules` (38 files) | **14 LOW** (SAFE) |
| [vercel-react-view-transitions](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions) | Guide for implementing smooth, native-feeling animations using React's View Transition API (`<ViewTransition>` component, `addTransitionType`, and CSS view transition pseudo-elements). Use this skill whenever the user wants to add page transitions, animate route changes, create shared element animations, animate enter/exit of components, animate list reorder, implement directional (forward/back) navigation animations, or integrate view transitions in Next.js. Also use when the user mentions view transitions, `startViewTransition`, `ViewTransition`, transition types, or asks about animating between UI states in React without third-party animation libraries. | `AGENTS.md`, `metadata.json`, `README.md`, `references` (4 files) | **7 LOW** (SAFE) |
| [vercel-cli-with-tokens](https://github.com/vercel-labs/agent-skills/tree/main/skills/vercel-cli-with-tokens) | Deploy and manage projects on Vercel using token-based authentication. Use when working with Vercel CLI using access tokens rather than interactive login — e.g. "deploy to vercel", "set up vercel", "add environment variables to vercel". | None | 0 (SAFE) |
| [web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". | None | 0 (SAFE) |

# vercel-labs.emulate.skills

| Name | Description | Bundled Assets | Security Risk |
| -----|-------------|----------------|---|

