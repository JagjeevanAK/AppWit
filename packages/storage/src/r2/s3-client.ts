import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import {
  isR2Configured,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} from "./config";

export async function deleteProjectFromR2(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!isR2Configured()) {
    console.log("[R2] R2 not configured, skipping delete");
    return false;
  }

  try {
    const prefix = `${userId}/${projectId}/`;
    console.log(`[R2] Deleting project backup with prefix: ${prefix}...`);

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });

    let continuationToken: string | undefined;
    let totalDeleted = 0;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME!,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listResult = await s3Client.send(listCommand);
      const objects = listResult.Contents || [];

      if (objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME!,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key })),
          },
        });

        await s3Client.send(deleteCommand);
        totalDeleted += objects.length;
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    console.log(
      `[R2] ✓ Deleted ${totalDeleted} objects from project ${projectId}`
    );
    return true;
  } catch (error) {
    console.error("[R2] Error deleting project from R2:", error);
    return false;
  }
}
