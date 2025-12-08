import { initializeR2ForSandbox, backupProject, restoreProject } from "./r2";
import { Sandbox } from "e2b";

async function testR2(sandbox: Sandbox) {

    const userId = "test_user";
    const projectId = "demo_project";

    console.log("\n=== STEP 1: Initialize + Mount R2 ===\n");

    const init = await initializeR2ForSandbox(sandbox, userId, projectId, false);
    if (!init.mounted) {
        console.error("❌ Failed to mount R2 bucket");
        return;
    }

    console.log("\n=== STEP 2: Create sample file locally ===\n");

    await sandbox.commands.run(`mkdir -p /home/user/project`);
    await sandbox.files.write("/home/user/project/hello.txt", "Hello from E2B!");
    console.log("Created file:", "/home/user/project/hello.txt");

    console.log("\n=== STEP 3: Run Backup → upload to R2 ===\n");

    const backupSuccess = await backupProject(sandbox, userId, projectId);
    if (!backupSuccess) {
        console.error("❌ Backup failed");
        return;
    }
    console.log("✓ Backup completed!");

    console.log("\n=== STEP 4: Delete local file to simulate loss ===\n");

    await sandbox.commands.run(`rm /home/user/project/hello.txt`);
    console.log("local file removed");

    const checkLocal = await sandbox.commands.run(`ls /home/user/project`);
    console.log("Local project files now:", checkLocal.stdout || "(empty)");

    console.log("\n=== STEP 5: Restore from R2 backup ===\n");

    const restoreSuccess = await restoreProject(sandbox, userId, projectId);
    if (!restoreSuccess) {
        console.error("❌ Restore failed");
        return;
    }

    console.log("\n=== STEP 6: Validate restore ===\n");

    const restored = await sandbox.commands.run(`cat /home/user/project/hello.txt`);
    console.log("Restored file content:", restored.stdout.trim());

    console.log("\n🌟 TEST COMPLETE — R2 backup/restore is working!\n");
}


async function main() {
    console.log("Starting R2 Test...");
    try {
        const sandbox = await Sandbox.create("tzw1pourwpe5cp9qj83u", {
            apiKey: process.env.E2B_API_KEY,
        });
        console.log("Sandbox created:", sandbox.sandboxId);

        await testR2(sandbox);

        await sandbox.kill();
        console.log("Sandbox killed.");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

main();
