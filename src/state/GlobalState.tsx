import React, { PureComponent } from 'react'

import {
  FavouriteGame,
  GameInfo,
  GameStatus,
  HiddenGame,
  InstalledInfo,
  LibraryTopSectionOptions,
  RefreshOptions,
  WineVersionInfo
} from 'src/types'
import { TFunction, withTranslation } from 'react-i18next'
import {
  getLegendaryConfig,
  getPlatform,
  install,
  launch,
  notify
} from 'src/helpers'
import { i18n, t } from 'i18next'

import ContextProvider from './ContextProvider'
import { getRecentGames } from 'src/helpers/library'

import {
  configStore,
  gogConfigStore,
  gogInstalledGamesStore,
  gogLibraryStore,
  libraryStore,
  wineDownloaderInfoStore
} from '../helpers/electronStores'

const storage: Storage = window.localStorage
const { ipcRenderer } = window.require('electron')

const RTL_LANGUAGES = ['fa']

type T = TFunction<'gamepage'> & TFunction<'translations'>

interface Props {
  children: React.ReactNode
  i18n: i18n
  t: T
}

interface StateProps {
  category: string
  epic: {
    library: GameInfo[]
    username: string | null
  }
  gog: {
    library: GameInfo[]
    username: string | null
  }
  wineVersions: WineVersionInfo[]
  error: boolean
  filter: string
  filterText: string
  filterPlatform: string
  gameUpdates: string[]
  language: string
  layout: string
  libraryStatus: GameStatus[]
  libraryTopSection: string
  platform: string
  refreshing: boolean
  refreshingInTheBackground: boolean
  hiddenGames: HiddenGame[]
  showHidden: boolean
  favouriteGames: FavouriteGame[]
  recentGames: GameInfo[]
  theme: string
  zoomPercent: number
  contentFontFamily: string
  actionsFontFamily: string
  allTilesInColor: boolean
}

export class GlobalState extends PureComponent<Props> {
  loadGOGLibrary = (): Array<GameInfo> => {
    const games = gogLibraryStore.has('games')
      ? (gogLibraryStore.get('games') as GameInfo[])
      : []
    const installedGames =
      (gogInstalledGamesStore.get('installed') as Array<InstalledInfo>) || []
    for (const igame in games) {
      for (const installedGame in installedGames) {
        if (installedGames[installedGame].appName === games[igame].app_name) {
          games[igame].install = installedGames[installedGame]
          games[igame].is_installed = true
        }
      }
    }

    return games
  }
  state: StateProps = {
    category: storage.getItem('category') || 'epic',
    epic: {
      library: libraryStore.has('library')
        ? (libraryStore.get('library') as GameInfo[])
        : [],
      username: configStore.get('userInfo')?.displayName || null
    },
    gog: {
      library: this.loadGOGLibrary(),
      username: gogConfigStore.get('userData')?.username || null
    },
    wineVersions: wineDownloaderInfoStore.has('wine-releases')
      ? (wineDownloaderInfoStore.get('wine-releases') as WineVersionInfo[])
      : [],
    error: false,
    filter: storage.getItem('filter') || 'all',
    filterText: '',
    filterPlatform: 'all',
    gameUpdates: [],
    language: this.props.i18n.language,
    layout: storage.getItem('layout') || 'grid',
    libraryStatus: [],
    libraryTopSection:
      storage.getItem('library_top_section') || 'recently_played',
    platform: '',
    refreshing: false,
    refreshingInTheBackground: true,
    hiddenGames: (configStore.get('games.hidden') as Array<HiddenGame>) || [],
    showHidden: JSON.parse(storage.getItem('show_hidden') || 'false'),
    favouriteGames:
      (configStore.get('games.favourites') as Array<FavouriteGame>) || [],
    recentGames: [],
    theme: (configStore.get('theme') as string) || '',
    zoomPercent: parseInt((configStore.get('zoomPercent') as string) || '100'),
    contentFontFamily:
      (configStore.get('contentFontFamily') as string) || "'Cabin', sans-serif",
    actionsFontFamily:
      (configStore.get('actionsFontFamily') as string) || "'Rubik', sans-serif",
    allTilesInColor: (configStore.get('allTilesInColor') as boolean) || false
  }

  setLanguage = (newLanguage: string) => {
    this.setState({ language: newLanguage })
  }

  setTheme = (newThemeName: string) => {
    configStore.set('theme', newThemeName)
    this.setState({ theme: newThemeName })
    document.body.className = newThemeName
  }

  zoomTimer: NodeJS.Timeout | undefined = undefined
  setZoomPercent = (newZoomPercent: number) => {
    if (this.zoomTimer) clearTimeout(this.zoomTimer)

    configStore.set('zoomPercent', newZoomPercent)
    this.setState({ zoomPercent: newZoomPercent })

    this.zoomTimer = setTimeout(() => {
      ipcRenderer.send('setZoomFactor', (newZoomPercent / 100).toString())
    }, 500)
  }

  setContentFontFamily = (newFontFamily: string) => {
    configStore.set('contentFontFamily', newFontFamily)
    this.setState({ contentFontFamily: newFontFamily })
  }

  setActionsFontFamily = (newFontFamily: string) => {
    configStore.set('actionsFontFamily', newFontFamily)
    this.setState({ actionsFontFamily: newFontFamily })
  }

  setAllTilesInColor = (value: boolean) => {
    configStore.set('allTilesInColor', value)
    this.setState({ allTilesInColor: value })
  }

  setShowHidden = (value: boolean) => {
    this.setState({ showHidden: value })
  }

  hideGame = (appNameToHide: string, appTitle: string) => {
    const newHiddenGames = [
      ...this.state.hiddenGames,
      { appName: appNameToHide, title: appTitle }
    ]

    this.setState({
      hiddenGames: newHiddenGames
    })
    configStore.set('games.hidden', newHiddenGames)
  }

  unhideGame = (appNameToUnhide: string) => {
    const newHiddenGames = this.state.hiddenGames.filter(
      ({ appName }) => appName !== appNameToUnhide
    )

    this.setState({
      hiddenGames: newHiddenGames
    })
    configStore.set('games.hidden', newHiddenGames)
  }

  addGameToFavourites = (appNameToAdd: string, appTitle: string) => {
    const newFavouriteGames = [
      ...this.state.favouriteGames.filter(
        (fav) => fav.appName !== appNameToAdd
      ),
      { appName: appNameToAdd, title: appTitle }
    ]

    this.setState({
      favouriteGames: newFavouriteGames
    })
    configStore.set('games.favourites', newFavouriteGames)
  }

  removeGameFromFavourites = (appNameToRemove: string) => {
    const newFavouriteGames = this.state.favouriteGames.filter(
      ({ appName }) => appName !== appNameToRemove
    )

    this.setState({
      favouriteGames: newFavouriteGames
    })
    configStore.set('games.favourites', newFavouriteGames)
  }

  handleLibraryTopSection = (value: LibraryTopSectionOptions) => {
    this.setState({ libraryTopSection: value })
  }

  handleSuccessfulLogin = (runner: 'epic' | 'gog') => {
    this.handleFilter('all')
    this.handleCategory(runner)
    this.refreshLibrary({
      fullRefresh: true,
      runInBackground: false
    })
  }

  epicLogin = async (sid: string) => {
    console.log('logging epic')
    const response = await ipcRenderer.invoke('login', sid)

    if (response.status === 'done') {
      this.setState({
        epic: {
          library: [],
          username: response.data.displayName
        }
      })

      this.handleSuccessfulLogin('epic')
    }

    return response.status
  }

  epicLogout = () => {
    ipcRenderer.invoke('logoutLegendary')
    console.log('Logging out from epic')
    window.location.reload()
  }

  gogLogin = async (token: string) => {
    console.log('logging gog')
    const response = await ipcRenderer.invoke('authGOG', token)

    if (response.status === 'done') {
      this.setState({
        gog: {
          library: [],
          username: response.data.username
        }
      })

      this.handleSuccessfulLogin('gog')
    }

    return response.status
  }

  gogLogout = () => {
    ipcRenderer.invoke('logoutGOG')
    console.log('Logging out from gog')
    window.location.reload()
  }

  refresh = async (checkUpdates?: boolean): Promise<void> => {
    console.log('refreshing')

    let updates = this.state.gameUpdates
    const currentLibraryLength = this.state.epic.library?.length
    let epicLibrary: Array<GameInfo> =
      (libraryStore.get('library') as Array<GameInfo>) || []

    const gogLibrary: Array<GameInfo> = this.loadGOGLibrary()
    if (!epicLibrary.length || !this.state.epic.library.length) {
      ipcRenderer.send(
        'logInfo',
        'No cache found, getting data from legendary...'
      )
      const { library: legendaryLibrary } = await getLegendaryConfig()
      epicLibrary = legendaryLibrary
    }

    try {
      updates = checkUpdates
        ? await ipcRenderer.invoke('checkGameUpdates')
        : this.state.gameUpdates
    } catch (error) {
      ipcRenderer.send('logError', error)
    }

    this.setState({
      epic: {
        library: epicLibrary,
        username: this.state.epic.username
      },
      gog: {
        library: gogLibrary,
        username: this.state.gog.username
      },
      gameUpdates: updates,
      refreshing: false,
      refreshingInTheBackground: true
    })

    if (currentLibraryLength !== epicLibrary.length) {
      ipcRenderer.send('logInfo', 'Force Update')
      this.forceUpdate()
    }
  }

  refreshLibrary = async ({
    checkForUpdates,
    fullRefresh,
    runInBackground = true
  }: RefreshOptions): Promise<void> => {
    if (this.state.refreshing) return

    this.setState({
      refreshing: true,
      refreshingInTheBackground: runInBackground
    })
    ipcRenderer.send('logInfo', 'Refreshing Library')
    try {
      await ipcRenderer.invoke('refreshLibrary', fullRefresh)
    } catch (error) {
      ipcRenderer.send('logError', error)
    }
    this.refresh(checkForUpdates)
  }

  refreshWineVersionInfo = async (fetch: boolean): Promise<void> => {
    if (this.state.platform !== 'linux') {
      return
    }
    ipcRenderer.send('logInfo', 'Refreshing wine downloader releases')
    this.setState({ refreshing: true })
    await ipcRenderer
      .invoke('refreshWineVersionInfo', fetch)
      .then((releases) => {
        this.setState({
          wineVersions: releases,
          refreshing: false
        })
        return
      })
      .catch(async () => {
        if (fetch) {
          // try to restore the saved information
          await ipcRenderer
            .invoke('refreshWineVersionInfo', false)
            .then((releases) => {
              this.setState({
                wineVersions: releases
              })
            })
        }

        this.setState({ refreshing: false })
        ipcRenderer.send('logError', 'Sync with upstream releases failed')

        notify([
          'Wine-Manager',
          t(
            'notify.refresh.error',
            "Couldn't fetch releases from upstream, maybe because of Github API restrictions! Try again later."
          )
        ])
        return
      })
  }

  handleSearch = (input: string) => this.setState({ filterText: input })
  handleFilter = (filter: string) => this.setState({ filter })
  handlePlatformFilter = (filterPlatform: string) =>
    this.setState({ filterPlatform })
  handleLayout = (layout: string) => this.setState({ layout })
  handleCategory = (category: string) => this.setState({ category })

  handleGameStatus = async ({
    appName,
    status,
    folder,
    progress
  }: GameStatus) => {
    const { libraryStatus, gameUpdates } = this.state
    const currentApp = libraryStatus.filter(
      (game) => game.appName === appName
    )[0]

    // add app to libraryStatus if it was not present
    if (!currentApp) {
      return this.setState({
        libraryStatus: [...libraryStatus, { appName, status, folder, progress }]
      })
    }

    // if the app's status didn't change, do nothing
    if (currentApp.status === status) {
      return
    }

    const newLibraryStatus = libraryStatus.filter(
      (game) => game.appName !== appName
    )

    // if the app is done installing or errored
    if (['error', 'done'].includes(status)) {
      // if the app was updating, remove from the available game updates
      if (currentApp.status === 'updating') {
        const updatedGamesUpdates = gameUpdates.filter(
          (game) => game !== appName
        )
        // This avoids calling legendary again before the previous process is killed when canceling
        this.refreshLibrary({
          checkForUpdates: true,
          runInBackground: true
        })

        storage.setItem(
          'updates',
          JSON.stringify(gameUpdates.filter((g) => g !== currentApp.appName))
        )

        return this.setState({
          gameUpdates: updatedGamesUpdates,
          libraryStatus: newLibraryStatus
        })
      }

      this.refreshLibrary({ runInBackground: true })
      this.setState({ libraryStatus: newLibraryStatus })
    }
  }

  async componentDidMount() {
    const { t } = this.props
    const { epic, gog, gameUpdates = [], libraryStatus } = this.state

    // Deals launching from protocol. Also checks if the game is already running
    ipcRenderer.on('launchGame', async (e, appName, runner) => {
      const currentApp = libraryStatus.filter(
        (game) => game.appName === appName
      )[0]
      if (!currentApp) {
        // Add finding a runner for games
        const hasUpdate = this.state.gameUpdates?.includes(appName)
        return launch({ appName, t, runner, hasUpdate })
      }
    })

    // TODO: show the install modal instead of just installing like this since it has no options to choose
    ipcRenderer.on('installGame', async (e, args) => {
      const currentApp = libraryStatus.filter(
        (game) => game.appName === appName
      )[0]
      const { appName, installPath, runner } = args
      if (!currentApp || (currentApp && currentApp.status !== 'installing')) {
        return install({
          appName,
          handleGameStatus: this.handleGameStatus,
          installPath,
          isInstalling: false,
          previousProgress: null,
          progress: {
            bytes: '0.00MiB',
            eta: '00:00:00',
            percent: '0.00%'
          },
          t,
          runner,
          platformToInstall: 'Windows'
        })
      }
    })

    ipcRenderer.on('setGameStatus', async (e, args: GameStatus) => {
      const { libraryStatus } = this.state
      this.handleGameStatus({ ...libraryStatus, ...args })
    })
    const legendaryUser = Boolean(configStore.get('userInfo'))
    const gogUser = Boolean(gogConfigStore.get('userData'))
    const platform = await getPlatform()

    if (legendaryUser) {
      await ipcRenderer.invoke('getUserInfo')
    }

    if (!gameUpdates.length) {
      const storedGameUpdates = JSON.parse(storage.getItem('updates') || '[]')
      this.setState({ gameUpdates: storedGameUpdates })
    }

    let recentGames: GameInfo[] = []

    if (epic.library.length > 0) {
      recentGames = [...getRecentGames(epic.library)]
    }
    if (gog.library.length > 0) {
      recentGames = [...recentGames, ...getRecentGames(gog.library)]
    }

    this.setState({
      platform,
      recentGames
    })

    if (legendaryUser || gogUser) {
      this.refreshLibrary({
        checkForUpdates: true,
        fullRefresh: true,
        runInBackground: Boolean(epic.library.length)
      })
    }
  }

  componentDidUpdate() {
    const {
      filter,
      gameUpdates,
      libraryStatus,
      layout,
      category,
      showHidden,
      libraryTopSection
    } = this.state

    storage.setItem('category', category)
    storage.setItem('filter', filter)
    storage.setItem('layout', layout)
    storage.setItem('updates', JSON.stringify(gameUpdates))
    storage.setItem('show_hidden', JSON.stringify(showHidden))
    storage.setItem('library_top_section', libraryTopSection)

    const pendingOps = libraryStatus.filter(
      (game) => game.status !== 'playing' && game.status !== 'done'
    ).length
    if (pendingOps) {
      ipcRenderer.send('lock')
    } else {
      ipcRenderer.send('unlock')
    }
  }

  render() {
    const isRTL = RTL_LANGUAGES.includes(this.state.language)

    return (
      <ContextProvider.Provider
        value={{
          ...this.state,
          epic: {
            library: this.state.epic.library,
            username: this.state.epic.username,
            login: this.epicLogin,
            logout: this.epicLogout
          },
          gog: {
            library: this.state.gog.library,
            username: this.state.gog.username,
            login: this.gogLogin,
            logout: this.gogLogout
          },
          handleCategory: this.handleCategory,
          handleFilter: this.handleFilter,
          handleGameStatus: this.handleGameStatus,
          handleLayout: this.handleLayout,
          handlePlatformFilter: this.handlePlatformFilter,
          handleSearch: this.handleSearch,
          setLanguage: this.setLanguage,
          isRTL,
          refresh: this.refresh,
          refreshLibrary: this.refreshLibrary,
          refreshWineVersionInfo: this.refreshWineVersionInfo,
          hiddenGames: {
            list: this.state.hiddenGames,
            add: this.hideGame,
            remove: this.unhideGame
          },
          setShowHidden: this.setShowHidden,
          favouriteGames: {
            list: this.state.favouriteGames,
            add: this.addGameToFavourites,
            remove: this.removeGameFromFavourites
          },
          handleLibraryTopSection: this.handleLibraryTopSection,
          setTheme: this.setTheme,
          setZoomPercent: this.setZoomPercent,
          setContentFontFamily: this.setContentFontFamily,
          setActionsFontFamily: this.setActionsFontFamily,
          setAllTilesInColor: this.setAllTilesInColor
        }}
      >
        {this.props.children}
      </ContextProvider.Provider>
    )
  }
}

export default withTranslation()(GlobalState)
