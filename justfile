set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-Command"]

# レシピの一覧を表示する
default:
    @just --list --unsorted

# site/ をローカルで配信する
dev port="8080":
    miniserve site --index index.html --interfaces 127.0.0.1 --port {{port}}
