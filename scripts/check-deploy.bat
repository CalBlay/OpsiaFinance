@echo off
cd /d C:\dev\OpsiaFinance
echo === LOCAL ===
git log -1 --oneline
git status -sb
echo.
echo === GITHUB MAIN ===
gh api repos/CalBlay/OpsiaFinance/commits/main -q ".sha + \" \" + .commit.message"
echo.
echo === COMMIT 8249c12 ===
gh api repos/CalBlay/OpsiaFinance/commits/8249c12 -q ".sha + \" \" + .commit.message"
echo.
echo === GITHUB CHECKS on 8249c12 ===
gh api repos/CalBlay/OpsiaFinance/commits/8249c12/check-runs -q ".check_runs[:10] | .[] | .name + \": \" + .status + \"/\" + (.conclusion // \"-\")"
echo.
echo === GITHUB DEPLOYMENTS ===
gh api "repos/CalBlay/OpsiaFinance/deployments?per_page=5" -q ".[] | .sha[0:7] + \" \" + .environment + \" \" + .created_at"
echo.
echo === RECENT COMMITS ON MAIN ===
gh api "repos/CalBlay/OpsiaFinance/commits?sha=main&per_page=5" -q ".[] | .sha[0:7] + \" \" + (.commit.message | split(\"\n\")[0])"
