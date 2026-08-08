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

## Verification

Render cards containing CJK characters (Simplified, Traditional, Japanese) and ensure characters are properly shaped without missing glyph (tofu) boxes.
