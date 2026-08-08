# CJK Font Strategy and Requirements

## Recommended Font Family

For consistent visual rendering of Simplified Chinese, Traditional Chinese, and Japanese characters across development, CI, and production environments, BangumiAgentKit Renderer relies on **Noto Sans CJK** (also known as Noto Sans SC/TC/JP).

## Environment Setup Instructions

### Linux / CI (Debian / Ubuntu / GitHub Actions)

Install `fonts-noto-cjk`:

```bash
sudo apt-get update && sudo apt-get install -y fonts-noto-cjk
```

### macOS

Install Noto Sans CJK via Homebrew or ensure Hiragino Sans / PingFang SC is installed:

```bash
brew install --cask font-noto-sans-cjk-sc
```

### Container / Docker Deployment

In Dockerfile (Debian/Alpine base):

```dockerfile
RUN apt-get update && apt-get install -y fonts-noto-cjk fontconfig && fc-cache -f -v
```

## Verification & Guarantees

- **Recommended Production Font Family**: **Noto Sans CJK** (also known as Noto Sans SC/TC/JP) is recommended for production environments.
- **CI Smoke Verification**: CI suite executes CJK rendering smoke tests (`R06`, `R07`, `R08`) verifying Chinese and Japanese cards render without layout crashes or buffer errors.
- **Cross-Platform Render Disclaimer**: Current CI does NOT guarantee cross-platform pixel-identical font selection unless the runtime explicitly installs the documented `fonts-noto-cjk` font package.

