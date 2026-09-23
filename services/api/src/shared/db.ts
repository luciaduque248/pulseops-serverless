import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const db = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

export const tableName = process.env.TABLE_NAME ?? 'pulseops-local';
export const attachmentsBucket = process.env.ATTACHMENTS_BUCKET ?? 'pulseops-local-attachments';
