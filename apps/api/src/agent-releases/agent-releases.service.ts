import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { Readable } from 'stream';

export type AgentPlatform = 'linux' | 'windows' | 'macos' | 'macos-arm64';

export interface PlatformReleaseInfo {
  platform: AgentPlatform;
  version: string;
  fileName: string;
  size: number;
  sha256: string;
  downloadPath: string;
  installScriptPath: string;
  installScriptFileName: string;
}

export interface AgentReleasesResponse {
  available: boolean;
  version: string | null;
  builtAt: string | null;
  platforms: PlatformReleaseInfo[];
}

interface ManifestFile {
  version?: string;
  builtAt?: string;
  platforms?: Record<
    string,
    {
      binary?: string;
      installScript?: string;
      sha256?: string;
      size?: number;
    }
  >;
}

const PLATFORM_FILES: Record<
  AgentPlatform,
  { binary: string; installScript: string }
> = {
  linux: {
    binary: 'workpulse-agent-linux-amd64',
    installScript: 'install-linux.sh',
  },
  windows: {
    binary: 'workpulse-agent-windows-amd64.exe',
    installScript: 'install-windows.ps1',
  },
  macos: {
    binary: 'workpulse-agent-darwin-amd64',
    installScript: 'install-macos.sh',
  },
  'macos-arm64': {
    binary: 'workpulse-agent-darwin-arm64',
    installScript: 'install-macos.sh',
  },
};

const PLATFORM_ORDER: AgentPlatform[] = [
  'linux',
  'windows',
  'macos',
  'macos-arm64',
];

@Injectable()
export class AgentReleasesService implements OnModuleInit {
  private readonly logger = new Logger(AgentReleasesService.name);
  private releasesDir = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.releasesDir = this.resolveReleasesDir();
    if (existsSync(this.releasesDir)) {
      this.logger.log(`Agent releases directory: ${this.releasesDir}`);
    } else {
      this.logger.warn(
        `Agent releases directory not found: ${this.releasesDir} (downloads will 404 until artifacts are built)`,
      );
    }
  }

  list(): AgentReleasesResponse {
    const manifest = this.readManifest();
    const platforms: PlatformReleaseInfo[] = [];

    for (const platform of PLATFORM_ORDER) {
      const info = this.platformInfo(platform, manifest);
      if (info) platforms.push(info);
    }

    return {
      available: platforms.length > 0,
      version: platforms[0]?.version ?? manifest?.version ?? null,
      builtAt: manifest?.builtAt ?? null,
      platforms,
    };
  }

  openBinary(platform: string): {
    stream: Readable;
    fileName: string;
    size: number;
    contentType: string;
  } {
    const p = this.assertPlatform(platform);
    const files = PLATFORM_FILES[p];
    const filePath = join(this.releasesDir, files.binary);
    if (!existsSync(filePath)) {
      throw new NotFoundException('فایل Agent برای این پلتفرم موجود نیست');
    }
    const stat = statSync(filePath);
    return {
      stream: createReadStream(filePath),
      fileName: files.binary,
      size: stat.size,
      contentType: 'application/octet-stream',
    };
  }

  openInstallScript(platform: string): {
    stream: Readable;
    fileName: string;
    size: number;
    contentType: string;
  } {
    const p = this.assertPlatform(platform);
    const files = PLATFORM_FILES[p];
    const filePath = this.resolveInstallScriptPath(files.installScript);
    if (!filePath) {
      throw new NotFoundException('اسکریپت نصب Agent موجود نیست');
    }
    const stat = statSync(filePath);
    return {
      stream: createReadStream(filePath),
      fileName: files.installScript,
      size: stat.size,
      contentType:
        p === 'windows' ? 'text/plain; charset=utf-8' : 'text/x-shellscript; charset=utf-8',
    };
  }

  private assertPlatform(platform: string): AgentPlatform {
    if (
      platform === 'linux' ||
      platform === 'windows' ||
      platform === 'macos' ||
      platform === 'macos-arm64'
    ) {
      return platform;
    }
    throw new NotFoundException(
      'پلتفرم پشتیبانی‌نشده است (linux، windows، macos، macos-arm64)',
    );
  }

  private platformInfo(
    platform: AgentPlatform,
    manifest: ManifestFile | null,
  ): PlatformReleaseInfo | null {
    const defaults = PLATFORM_FILES[platform];
    const meta = manifest?.platforms?.[platform];
    const binaryName = meta?.binary || defaults.binary;
    const scriptName = meta?.installScript || defaults.installScript;
    const binaryPath = join(this.releasesDir, binaryName);
    const scriptPath = this.resolveInstallScriptPath(scriptName);

    if (!existsSync(binaryPath) || !scriptPath) {
      return null;
    }

    const stat = statSync(binaryPath);
    const sha256 =
      meta?.sha256 && meta.sha256.length > 0
        ? meta.sha256
        : this.sha256File(binaryPath);

    return {
      platform,
      version: manifest?.version || '0.4.0',
      fileName: binaryName,
      size: meta?.size && meta.size > 0 ? meta.size : stat.size,
      sha256,
      downloadPath: `/agent/releases/${platform}/download`,
      installScriptPath: `/agent/releases/${platform}/install-script`,
      installScriptFileName: scriptName,
    };
  }

  private readManifest(): ManifestFile | null {
    const path = join(this.releasesDir, 'manifest.json');
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ManifestFile;
    } catch {
      return null;
    }
  }

  private sha256File(filePath: string): string {
    const hash = createHash('sha256');
    hash.update(readFileSync(filePath));
    return hash.digest('hex');
  }

  private resolveInstallScriptPath(fileName: string): string | null {
    const inReleases = join(this.releasesDir, fileName);
    if (existsSync(inReleases)) return inReleases;

    const localInstall = resolve(process.cwd(), '../agent/install', fileName);
    if (existsSync(localInstall)) return localInstall;

    const imageInstall = join('/app/agent-releases', fileName);
    if (existsSync(imageInstall)) return imageInstall;

    return null;
  }

  private resolveReleasesDir(): string {
    const configured = this.config.get<string>('AGENT_RELEASES_DIR');
    if (configured) return resolve(configured);

    const inImage = '/app/agent-releases';
    if (existsSync(inImage)) return inImage;

    const localReleases = resolve(process.cwd(), '../agent/releases');
    if (existsSync(localReleases)) return localReleases;

    const localBin = resolve(process.cwd(), '../agent/bin');
    if (existsSync(localBin)) return localBin;

    return inImage;
  }
}
