// IDE-01: the IntelliJ plugin, a Gradle build of its own inside the repository.
import org.jetbrains.intellij.platform.gradle.extensions.intellijPlatform

rootProject.name = "aisus-intellij"

plugins {
    id("org.jetbrains.intellij.platform.settings") version "2.19.0"
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        intellijPlatform {
            defaultRepositories()
        }
    }
}
