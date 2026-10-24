// IDE-01: runs the core CLI with node, off the UI thread, and answers on it.
package aisus.intellij

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.execution.process.ProcessOutput
import com.intellij.execution.util.ExecUtil
import com.intellij.openapi.application.EDT
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.platform.ide.progress.withBackgroundProgress
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Path

@Service(Service.Level.PROJECT)
class NodeCli(private val project: Project, private val scope: CoroutineScope) {
    /** Runs `node <args>` in [root]; [done] gets the output on the UI thread, or nothing when node or the core is missing. */
    fun run(root: Path, args: (cli: Path) -> List<String>, done: (ProcessOutput) -> Unit) {
        scope.launch {
            val output = withBackgroundProgress(project, "aisus") {
                withContext(Dispatchers.IO) {
                    val node = PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS("node") ?: return@withContext null
                    try {
                        val command = GeneralCommandLine(listOf(node.absolutePath) + args(AisusCore.cli()))
                            .withWorkDirectory(root.toFile())
                            .withCharset(StandardCharsets.UTF_8)
                        ExecUtil.execAndGetOutput(command, 120_000)
                    } catch (e: ExecutionException) {
                        null
                    } catch (e: IOException) {
                        null
                    }
                }
            }
            withContext(Dispatchers.EDT) {
                if (output == null) Notify.error(project, "aisus could not run Node.js. Install Node.js 18 or newer and make sure it is on PATH.") else done(output)
            }
        }
    }
}
