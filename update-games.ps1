# update-games.ps1
# このスクリプトはルートディレクトリで実行してください。
# サブディレクトリのindex.htmlをスキャンし、タイトルを抜き出してgames.jsonに保存します。

$rootDir = Get-Location
$games = @()

Get-ChildItem -Directory | ForEach-Object {
    $dir = $_.Name
    $indexPath = Join-Path $rootDir "$dir\index.html"
    if (Test-Path $indexPath) {
        $content = Get-Content $indexPath -Raw -Encoding UTF8
        $titleMatch = [regex]::Match($content, '<title>(.*?)</title>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $title = if ($titleMatch.Success) { $titleMatch.Groups[1].Value.Trim() } else { $dir }
        $games += @{ path = $dir; title = $title }
    }
}

$games | ConvertTo-Json -Compress | Out-File -FilePath "games.json" -Encoding UTF8

Write-Host "games.json を更新しました。"