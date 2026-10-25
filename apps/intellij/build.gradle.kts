// IDE-01: the aisus plugin for IntelliJ IDEA 2026.1 and later. The map viewer, the core CLI and the
// skills come from the repository's own build: run `npm run build` and `node esbuild.mjs --intellij`
// at the repository root first. They are packed into the plugin as one zip that it unpacks on first use.
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.4.21"
    // The settings plugin already loaded this plugin's jar, so it takes no version here.
    id("org.jetbrains.intellij.platform")
}

group = "aisus"
version = providers.gradleProperty("pluginVersion").get()

val platformVersion = providers.gradleProperty("platformVersion").get()
val repository = layout.projectDirectory.dir("../..")

dependencies {
    intellijPlatform {
        intellijIdea(platformVersion)
        bundledPlugin("org.jetbrains.plugins.terminal")
        // From 2026.2, JCEF is the bundled "Web Browser (JCEF)" plugin. In 2026.1 it is part of the platform.
        if (!platformVersion.startsWith("2026.1")) {
            bundledPlugin("com.intellij.modules.jcef")
        }
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
}

intellijPlatform {
    buildSearchableOptions = false
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "261"
            // until-build stays unset, so the plugin also loads on 2026.2 and later.
        }
    }
    pluginVerification {
        ides {
            current()
        }
    }
}

kotlin {
    jvmToolchain(21)
    compilerOptions {
        // IntelliJ 2026.1 bundles the Kotlin 2.3 standard library.
        apiVersion = KotlinVersion.KOTLIN_2_3
        // Interface defaults stay in the platform's interfaces, so the plugin does not override
        // ToolWindowFactory's deprecated defaults by generating bridges for them.
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

// The viewer, the core CLI and the skills, laid out as dist/ lays them out, so the CLI finds its skills.
val aisusCore = tasks.register<Zip>("aisusCore") {
    val viewer = repository.dir("out/intellij")
    val dist = repository.dir("dist")
    doFirst {
        val missing = listOf(viewer.file("jcef.js"), viewer.file("jcef.css"), dist.file("cli/aisus.mjs"), dist.file("skill-hashes.json"))
            .map { it.asFile }.filterNot { it.isFile }
        check(missing.isEmpty()) { "Build the repository first (npm run build, then node esbuild.mjs --intellij). Missing: ${missing.joinToString()}" }
    }
    archiveFileName = "aisus-core.zip"
    destinationDirectory = layout.buildDirectory.dir("generated/aisus-core/aisus")
    from(viewer) { include("jcef.js", "jcef.css"); into("viewer") }
    from(dist) { include("cli/**", "skills/**", "skill-hashes.json"); into("dist") }
}

// Only packing the plugin needs the core, so compiling and testing work without it.
sourceSets.main {
    resources.srcDir(layout.buildDirectory.dir("generated/aisus-core"))
}
tasks.processResources {
    dependsOn(aisusCore)
}
