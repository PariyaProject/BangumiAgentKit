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
      options.ttlMinutes ??
      parseInt(process.env.BANGUMI_ARTIFACT_TTL_MINUTES || '1440', 10);

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
    const randomHex = crypto.randomBytes(16).toString('hex');
    const id = `art_${randomHex}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMinutes * 60 * 1000);

    const ext = mimeType === 'image/png' ? '.png' : '.bin';
    const filePath = path.join(this.artifactDir, `${id}${ext}`);
    const metaPath = path.join(this.artifactDir, `${id}.json`);
    const tmpPath = path.join(this.artifactDir, `${id}.tmp`);

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
    if (!this.isValidArtifactId(id)) {
      return null;
    }

    const metaPath = path.join(this.artifactDir, `${id}.json`);
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
    if (!this.isValidArtifactId(id)) {
      return null;
    }

    const meta = await this.getArtifact(id);
    if (!meta) {
      return null;
    }

    if (fs.existsSync(meta.filePath)) {
      return meta.filePath;
    }

    return null;
  }

  async cleanExpiredArtifacts(): Promise<number> {
    if (!fs.existsSync(this.artifactDir)) return 0;
    const files = fs.readdirSync(this.artifactDir);
    const now = new Date();
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const metaPath = path.join(this.artifactDir, file);
        try {
          const content = fs.readFileSync(metaPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (now > new Date(parsed.expiresAt)) {
            const id = parsed.id;
            const dataPath = path.join(this.artifactDir, `${id}.png`);
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

  private isValidArtifactId(id: string): boolean {
    return Boolean(id && typeof id === 'string' && id.match(/^art_[A-Za-z0-9_-]+$/));
  }
}
