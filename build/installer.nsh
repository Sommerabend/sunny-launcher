!macro preInit
  ; Close an already running launcher before NSIS writes/replaces the uninstaller.
  nsExec::ExecToLog 'taskkill /F /IM "Sunny Games Launcher.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "SunnyGamesLauncher.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "Sunny Client.exe" /T'
  Sleep 700
  ; Remove stale uninstallers from older Sunny builds if they are not locked.
  Delete "$INSTDIR\Uninstall Sunny Games Launcher.exe"
  Delete "$INSTDIR\Uninstall Sunny Client.exe"
!macroend
