// IDE-01: the repository aisus maps is the project's base folder.
package aisus.intellij

import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import java.nio.file.Path

fun Project.aisusRoot(): Path? =
    guessProjectDir()?.takeIf { it.isInLocalFileSystem }?.toNioPath() ?: basePath?.let { Path.of(it) }
