import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export interface ArtifactRef {
  id: string;
  mimeType: 'image/png';
  width?: number;
  height?: number;
  expiresAt: string;
}

export interface ArtifactMetadata {
  id: string;
  mimeType: 'image/png';
  width?: number;
  height?: number;
  filePath: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ArtifactStore {
  saveArtifact(
    buffer: Buffer,
    mimeType?: 'image/png',
    options?: { width?: number; height?: number },
  ): Promise<ArtifactRef>;
  getArtifact(id: string): Promise<ArtifactMetadata | null>;
  resolveFilePath(id: string): Promise<string | null>;
  cleanExpiredArtifacts(): Promise<number>;
}

export interface PrincipalScopedArtifactStore extends ArtifactStore {
  saveArtifactForPrincipal(
    principalId: string,
    buffer: Buffer,
    mimeType?: 'image/png',
    options?: { width?: number; height?: number },
  ): Promise<ArtifactRef>;
  getArtifactForPrincipal(principalId: string, id: string): Promise<ArtifactMetadata | null>;
  resolveFilePathForPrincipal(principalId: string, id: string): Promise<string | null>;
}

export function isPrincipalScopedArtifactStore(
  store: ArtifactStore,
): store is PrincipalScopedArtifactStore {
  return (
    typeof (store as Partial<PrincipalScopedArtifactStore>).saveArtifactForPrincipal ===
      'function' &&
    typeof (store as Partial<PrincipalScopedArtifactStore>).getArtifactForPrincipal ===
      'function' &&
    typeof (store as Partial<PrincipalScopedArtifactStore>).resolveFilePathForPrincipal ===
      'function'
  );
}

export function isPrivateArtifactId(id: string): boolean {
  return /^art_p_[a-f0-9]{24}_[a-f0-9]{32}$/u.test(id);
}

function isPrivateArtifactPrefix(id: string): boolean {
  return id.startsWith('art_p_');
}

function principalScope(principalId: string): string {
  return crypto.createHash('sha256').update(principalId).digest('hex').slice(0, 24);
}

export function resolveArtifactDir(customDir?: string): string {
  if (customDir) return customDir;
  if (process.env.BANGUMI_ARTIFACT_DIR) return process.env.BANGUMI_ARTIFACT_DIR;

  const baseDataDir = process.env.BANGUMI_DATA_DIR || path.join(os.homedir(), '.bangumi-agent-kit');
  return path.join(baseDataDir, 'artifacts');
}

export class LocalArtifactStore implements ArtifactStore {
  private artifactDir: string;
  private ttlMinutes: number;

  constructor(options: { artifactDir?: string; ttlMinutes?: number } = {}) {
    this.artifactDir = resolveArtifactDir(options.artifactDir);
    this.ttlMinutes =
      options.ttlMinutes ?? parseInt(process.env.BANGUMI_ARTIFACT_TTL_MINUTES || '1440', 10);

    if (!fs.existsSync(this.artifactDir)) {
      fs.mkdirSync(this.artifactDir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(this.artifactDir, 0o700);
      } catch {
        // best effort
      }
    }
  }

  async saveArtifact(
    buffer: Buffer,
    mimeType: 'image/png' = 'image/png',
    options: { width?: number; height?: number } = {},
  ): Promise<ArtifactRef> {
    return this.writeArtifact(
      this.artifactDir,
      `art_${crypto.randomBytes(16).toString('hex')}`,
      buffer,
      mimeType,
      options,
    );
  }

  async saveArtifactForPrincipal(
    principalId: string,
    buffer: Buffer,
    mimeType: 'image/png' = 'image/png',
    options: { width?: number; height?: number } = {},
  ): Promise<ArtifactRef> {
    if (!principalId) throw new Error('Principal-scoped artifacts require a principal id.');
    const scope = principalScope(principalId);
    const privateDir = path.join(this.artifactDir, 'private', scope);
    const id = `art_p_${scope}_${crypto.randomBytes(16).toString('hex')}`;
    return this.writeArtifact(privateDir, id, buffer, mimeType, options);
  }

  private writeArtifact(
    artifactDir: string,
    id: string,
    buffer: Buffer,
    mimeType: 'image/png',
    options: { width?: number; height?: number },
  ): ArtifactRef {
    this.ensureDirectory(artifactDir);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMinutes * 60 * 1000);

    const ext = mimeType === 'image/png' ? '.png' : '.bin';
    const filePath = path.join(artifactDir, `${id}${ext}`);
    const metaPath = path.join(artifactDir, `${id}.json`);
    const tmpPath = path.join(artifactDir, `${id}.tmp`);

    // Atomic write
    fs.writeFileSync(tmpPath, buffer);
    try {
      fs.chmodSync(tmpPath, 0o600);
    } catch {
      // best effort
    }
    fs.renameSync(tmpPath, filePath);

    const meta: ArtifactMetadata = {
      id,
      mimeType,
      width: options.width,
      height: options.height,
      filePath,
      createdAt: now,
      expiresAt,
    };

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });

    return {
      id,
      mimeType,
      width: options.width,
      height: options.height,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getArtifact(id: string): Promise<ArtifactMetadata | null> {
    if (!this.isValidArtifactId(id) || isPrivateArtifactPrefix(id)) {
      return null;
    }
    return this.readArtifact(this.artifactDir, id);
  }

  async getArtifactForPrincipal(principalId: string, id: string): Promise<ArtifactMetadata | null> {
    if (!principalId || !this.isValidArtifactId(id) || !isPrivateArtifactId(id)) return null;
    if (!id.startsWith(`art_p_${principalScope(principalId)}_`)) return null;
    return this.readArtifact(
      path.join(this.artifactDir, 'private', principalScope(principalId)),
      id,
    );
  }

  private readArtifact(artifactDir: string, id: string): ArtifactMetadata | null {
    const metaPath = path.join(artifactDir, `${id}.json`);
    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(metaPath, 'utf-8');
      const parsed = JSON.parse(content);
      const expiresAt = new Date(parsed.expiresAt);

      if (new Date() > expiresAt) {
        return null;
      }

      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        expiresAt,
      };
    } catch {
      return null;
    }
  }

  async resolveFilePath(id: string): Promise<string | null> {
    if (!this.isValidArtifactId(id) || isPrivateArtifactPrefix(id)) {
      return null;
    }
    const meta = await this.getArtifact(id);
    return this.resolveArtifactPath(meta);
  }

  async resolveFilePathForPrincipal(principalId: string, id: string): Promise<string | null> {
    const meta = await this.getArtifactForPrincipal(principalId, id);
    return this.resolveArtifactPath(meta);
  }

  private resolveArtifactPath(meta: ArtifactMetadata | null): string | null {
    if (!meta) {
      return null;
    }

    if (fs.existsSync(meta.filePath)) {
      return meta.filePath;
    }

    return null;
  }

  async cleanExpiredArtifacts(): Promise<number> {
    return (
      this.cleanExpiredArtifactsInDirectory(this.artifactDir) + this.cleanExpiredPrivateArtifacts()
    );
  }

  private cleanExpiredPrivateArtifacts(): number {
    const privateRoot = path.join(this.artifactDir, 'private');
    if (!fs.existsSync(privateRoot)) return 0;
    return fs
      .readdirSync(privateRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[a-f0-9]{24}$/u.test(entry.name))
      .reduce(
        (count, entry) =>
          count + this.cleanExpiredArtifactsInDirectory(path.join(privateRoot, entry.name)),
        0,
      );
  }

  private cleanExpiredArtifactsInDirectory(artifactDir: string): number {
    if (!fs.existsSync(artifactDir)) return 0;
    const files = fs.readdirSync(artifactDir);
    const now = new Date();
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metaPath = path.join(artifactDir, file);
        try {
          const content = fs.readFileSync(metaPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (now > new Date(parsed.expiresAt)) {
            const id = parsed.id;
            const dataPath = path.join(artifactDir, `${id}.png`);
            if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
            count++;
          }
        } catch {
          // ignore corrupted meta
        }
      }
    }
    return count;
  }

  private ensureDirectory(artifactDir: string): void {
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(artifactDir, 0o700);
      } catch {
        // best effort
      }
    }
  }

  private isValidArtifactId(id: string): boolean {
    return Boolean(id && typeof id === 'string' && id.match(/^art_[A-Za-z0-9_-]+$/));
  }
}
