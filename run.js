name: Extend XServer GAMES Server

on:
  schedule:
    - cron: '0 12 * * *'
  
  workflow_dispatch:

jobs:
  extend:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install Japanese fonts
        run: sudo apt-get update && sudo apt-get install -y fonts-ipafont

      - name: Install dependencies
        run: npm install playwright-chromium node-fetch

      - name: Run Automation Script
        env:
          XSERVER_EMAIL: ${{ secrets.XSERVER_EMAIL }}
          XSERVER_PASSWORD: ${{ secrets.XSERVER_PASSWORD }}
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
        run: node run.js

      - name: Send Video to Discord
        if: always()
        run: |
          if ls videos/*.webm 1> /dev/null 2>&1; then
            echo "Video found, preparing to upload..."
            VIDEO_FILE=$(ls videos/*.webm | head -n 1)
            curl -s -F "payload_json={\"content\":\"XServer GAMES 自動延長の実行結果ビデオです。\"}" -F "file1=@$VIDEO_FILE" ${{ secrets.DISCORD_WEBHOOK_URL }}
            echo "Video upload command sent."
          else
            echo "No video file found to upload."
          fi

      - name: Upload Video Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: automation-video
          path: videos/
          retention-days: 7
