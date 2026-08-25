#!/usr/bin/env node
import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load .env then .env.local using Node's built-in loader (Node >= 20.12, and
 * .nvmrc pins 22.12). Using `process.loadEnvFile` keeps this script free of a
 * `dotenv` dependency that was never declared in package.json.
 *
 * Precedence matches the previous dotenv call exactly: a variable already set
 * in the real environment wins, and otherwise the first file to define it wins
 * (so `.env` takes precedence over `.env.local`). Missing files are skipped.
 */
for (const envFile of ['../.env', '../.env.local']) {
  const path = resolve(__dirname, envFile);
  if (!existsSync(path)) continue;
  try {
    process.loadEnvFile(path);
  } catch {
    console.warn(`⚠️  Could not read ${path}; continuing with the current environment.`);
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH!;
const ENCRYPTION_KEY = process.env.SUPERADMIN_ENCRYPTION_KEY!;

const isGenerateCommand = process.argv.some(
  (arg) => arg === 'generate-password-hash' || arg === 'generate-encryption-key',
);

const isCryptoCommand = process.argv.some((arg) => arg === 'encrypt' || arg === 'decrypt');

if (!isGenerateCommand && !isCryptoCommand) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPERADMIN_PASSWORD_HASH || !ENCRYPTION_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('  VITE_SUPABASE_URL');
    console.error('  SUPABASE_SERVICE_ROLE_KEY');
    console.error('  SUPERADMIN_PASSWORD_HASH');
    console.error('  SUPERADMIN_ENCRYPTION_KEY');
    process.exit(1);
  }
}

if (isCryptoCommand && !ENCRYPTION_KEY) {
  console.error('❌ Missing required environment variable: SUPERADMIN_ENCRYPTION_KEY');
  process.exit(1);
}

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, KEY_LENGTH);
}

function encrypt(text: string, password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

function decrypt(encryptedData: string, password: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

async function _verifyPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, SUPERADMIN_PASSWORD_HASH);
}

async function verifySuperAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }
  return data.is_super_admin === true;
}

async function authenticateSuperAdmin(email: string, password: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw new Error('Authentication failed: Invalid credentials');
  }

  const isSuperAdmin = await verifySuperAdmin(authData.user.id);
  if (!isSuperAdmin) {
    await supabase.auth.signOut();
    throw new Error('Access denied: User is not a superadmin');
  }

  return authData.user.id;
}

async function createAcademyCommand(options: {
  name: string;
  ownerEmail: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone?: string;
  feeMode?: string;
}) {
  const supabase = getSupabaseClient();
  const { data: owner, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', options.ownerEmail)
    .single();

  if (error || !owner) {
    throw new Error(`Owner not found: ${options.ownerEmail}`);
  }

  const { data, error: rpcError } = await supabase.rpc('create_platform_academy', {
    p_name: options.name,
    p_owner_user_id: owner.id,
    p_city: options.city ?? null,
    p_contact_email: options.contactEmail ?? null,
    p_contact_phone: options.contactPhone ?? null,
    p_timezone: options.timezone ?? 'Asia/Kolkata',
    p_fee_mode: options.feeMode ?? 'player_pays',
  });

  if (rpcError) {
    throw new Error(`Failed to create academy: ${rpcError.message}`);
  }

  console.log('✅ Academy created successfully:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Name: ${data.name}`);
  console.log(`   Slug: ${data.slug}`);
  console.log(`   Owner: ${options.ownerEmail}`);
}

async function deleteAcademyCommand(academyId: string, confirmName: string) {
  const supabase = getSupabaseClient();
  const { data: academy, error } = await supabase
    .from('academies')
    .select('name')
    .eq('id', academyId)
    .single();

  if (error || !academy) {
    throw new Error(`Academy not found: ${academyId}`);
  }

  if (academy.name !== confirmName) {
    throw new Error(`Academy name mismatch. Expected: "${academy.name}", Got: "${confirmName}"`);
  }

  const { error: rpcError } = await supabase.rpc('delete_platform_academy', {
    p_academy_id: academyId,
  });

  if (rpcError) {
    throw new Error(`Failed to delete academy: ${rpcError.message}`);
  }

  console.log(`✅ Academy "${academy.name}" (${academyId}) deleted successfully`);
}

async function listAcademiesCommand() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_platform_academies');

  if (error) {
    throw new Error(`Failed to list academies: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('No academies found');
    return;
  }

  console.log('\n📋 Platform Academies:');
  console.log('─'.repeat(100));
  console.log(
    `${'ID'.padEnd(38)} | ${'Name'.padEnd(30)} | ${'Owner'.padEnd(25)} | ${'Members'.padEnd(8)} | ${'Created'}`,
  );
  console.log('─'.repeat(100));

  for (const acad of data) {
    console.log(
      `${acad.id.padEnd(38)} | ${acad.name.padEnd(30)} | ${acad.ownerName.padEnd(25)} | ${String(acad.memberCount).padEnd(8)} | ${new Date(acad.createdAt).toISOString().split('T')[0]}`,
    );
  }
  console.log('─'.repeat(100));
  console.log(`Total: ${data.length} academies\n`);
}

async function generatePasswordHashCommand(options: { password: string }) {
  const hash = await bcrypt.hash(options.password, 12);
  console.log('🔑 Password hash (add to .env as SUPERADMIN_PASSWORD_HASH):');
  console.log(hash);
}

async function generateEncryptionKeyCommand() {
  const key = crypto.randomBytes(32).toString('hex');
  console.log('🔐 Encryption key (add to .env as SUPERADMIN_ENCRYPTION_KEY):');
  console.log(key);
}

async function encryptDataCommand(options: { data: string }) {
  const encrypted = encrypt(options.data, ENCRYPTION_KEY);
  console.log('🔐 Encrypted data:');
  console.log(encrypted);
}

async function decryptDataCommand(options: { data: string }) {
  try {
    const decrypted = decrypt(options.data, ENCRYPTION_KEY);
    console.log('🔓 Decrypted data:');
    console.log(decrypted);
  } catch {
    throw new Error('Decryption failed: Invalid data or key');
  }
}

const program = new Command();

program
  .name('superadmin')
  .description('SuperAdmin CLI for Cricket Academy Manager - Secure platform management')
  .version('1.0.0')
  .addHelpText(
    'after',
    `
Examples:
  $ superadmin auth --email admin@example.com --password "secret123" create-academy --name "New Academy" --owner-email owner@example.com
  $ superadmin auth --email admin@example.com --password "secret123" delete-academy --id "uuid-here" --confirm-name "Academy Name"
  $ superadmin auth --email admin@example.com --password "secret123" list-academies
  $ superadmin generate-password-hash --password "my-secret-password"
  $ superadmin generate-encryption-key
  $ superadmin encrypt --data "sensitive-data"
  $ superadmin decrypt --data "encrypted-base64-string"
`,
  );

program
  .command('generate-password-hash')
  .description('Generate bcrypt hash for superadmin password')
  .requiredOption('-p, --password <password>', 'Password to hash')
  .action(generatePasswordHashCommand);

program
  .command('generate-encryption-key')
  .description('Generate a new encryption key for data encryption')
  .action(generateEncryptionKeyCommand);

program
  .command('encrypt')
  .description('Encrypt data using the encryption key')
  .requiredOption('-d, --data <data>', 'Data to encrypt')
  .action(encryptDataCommand);

program
  .command('decrypt')
  .description('Decrypt data using the encryption key')
  .requiredOption('-d, --data <data>', 'Encrypted data (base64)')
  .action(decryptDataCommand);

const authCommand = program
  .command('auth')
  .description('Authenticate as superadmin and run a command')
  .requiredOption('-e, --email <email>', 'Superadmin email')
  .requiredOption('-p, --password <password>', 'Superadmin password')
  .requiredOption(
    '-c, --command <command>',
    'Command to run (create-academy, delete-academy, list-academies)',
  );

authCommand
  .command('create-academy')
  .description('Create a new academy')
  .requiredOption('-n, --name <name>', 'Academy name')
  .requiredOption('-o, --owner-email <email>', 'Owner email (must exist in profiles)')
  .option('--city <city>', 'City')
  .option('--contact-email <email>', 'Contact email')
  .option('--contact-phone <phone>', 'Contact phone')
  .option('--timezone <timezone>', 'Timezone', 'Asia/Kolkata')
  .option('--fee-mode <mode>', 'Fee mode (player_pays, academy_pays, hybrid)', 'player_pays')
  .action(async (options) => {
    try {
      await authenticateSuperAdmin(program.opts().email, program.opts().password);
      await createAcademyCommand(options);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

authCommand
  .command('delete-academy')
  .description('Delete an academy (irreversible)')
  .requiredOption('-i, --id <id>', 'Academy ID')
  .requiredOption('--confirm-name <name>', 'Academy name for confirmation')
  .action(async (options) => {
    try {
      await authenticateSuperAdmin(program.opts().email, program.opts().password);
      await deleteAcademyCommand(options.id, options.confirmName);
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

authCommand
  .command('list-academies')
  .description('List all academies on the platform')
  .action(async () => {
    try {
      await authenticateSuperAdmin(program.opts().email, program.opts().password);
      await listAcademiesCommand();
    } catch (error) {
      console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
