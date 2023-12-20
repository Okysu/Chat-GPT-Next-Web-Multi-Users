import { useEffect, useRef, useMemo, useState } from "react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
import GithubIcon from "../icons/github.svg";
import ChatGptIcon from "../icons/chatgpt.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import DeleteIcon from "../icons/delete.svg";
import MaskIcon from "../icons/mask.svg";
import PluginIcon from "../icons/plugin.svg";
import DragIcon from "../icons/drag.svg";

import Locale from "../locales";

import {
  useAccessStore,
  useAppConfig,
  useChatStore,
  useUserConfig,
} from "../store";

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
  REPO_URL,
} from "../constant";

import { Link, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { showConfirm, showToast } from "./ui-lib";
import { Avatar } from "./emoji";
import { getClientConfig } from "../config/client";

const multipleUserMode = getClientConfig()?.multipleUserMode;
const setedAccessCode = useAccessStore.getState().accessCode;

const displayUser = multipleUserMode && !setedAccessCode;

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

function truncate(str: string, length: number, suffix: string = "...") {
  if (str.length <= length) return str;
  return str.slice(0, length) + suffix;
}

async function getWalletLeft() {
  const token = useUserConfig.getState().token;
  return await fetch("/api/user/wallet", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
  });
}

function useHotKey() {
  const chatStore = useChatStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey) {
        if (e.key === "ArrowUp") {
          chatStore.nextSession(-1);
        } else if (e.key === "ArrowDown") {
          chatStore.nextSession(1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}

function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastUpdateTime = useRef(Date.now());

  const toggleSideBar = () => {
    config.update((config) => {
      if (config.sidebarWidth < MIN_SIDEBAR_WIDTH) {
        config.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      } else {
        config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
      }
    });
  };

  const onDragStart = (e: MouseEvent) => {
    // Remembers the initial width each time the mouse is pressed
    startX.current = e.clientX;
    startDragWidth.current = config.sidebarWidth;
    const dragStartTime = Date.now();

    const handleDragMove = (e: MouseEvent) => {
      if (Date.now() < lastUpdateTime.current + 20) {
        return;
      }
      lastUpdateTime.current = Date.now();
      const d = e.clientX - startX.current;
      const nextWidth = limit(startDragWidth.current + d);
      config.update((config) => {
        if (nextWidth < MIN_SIDEBAR_WIDTH) {
          config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
        } else {
          config.sidebarWidth = nextWidth;
        }
      });
    };

    const handleDragEnd = () => {
      // In useRef the data is non-responsive, so `config.sidebarWidth` can't get the dynamic sidebarWidth
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      // if user click the drag icon, should toggle the sidebar
      const shouldFireClick = Date.now() - dragStartTime < 300;
      if (shouldFireClick) {
        toggleSideBar();
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };

  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragStart,
    shouldNarrow,
  };
}

export function SideBar(props: { className?: string }) {
  const chatStore = useChatStore();
  const userStore = useUserConfig();

  const [walletLeft, setWalletLeft] = useState(0);

  const getWallet = () => {
    getWalletLeft().then(async (res) => {
      if (res.status === 200) {
        res.json().then((res) => {
          setWalletLeft(res.left);
        });
      } else {
        showToast((await res.json()).message);
      }
    });
  };

  useEffect(() => {
    if (userStore.isUserLoggedIn()) {
      getWallet();
    }
    window.onmessage = (e) => {
      if (e.data.type === "chat-input") {
        getWallet();
      }
    };
  }, [userStore.user]);

  // drag side bar
  const { onDragStart, shouldNarrow } = useDragSideBar();
  const navigate = useNavigate();
  const config = useAppConfig();
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );

  useHotKey();

  return (
    <div
      className={`${styles.sidebar} ${props.className} ${
        shouldNarrow && styles["narrow-sidebar"]
      }`}
      style={{
        // #3016 disable transition on ios mobile screen
        transition: isMobileScreen && isIOSMobile ? "none" : undefined,
      }}
    >
      <div className={styles["sidebar-header"]} data-tauri-drag-region>
        <div className={styles["sidebar-title"]} data-tauri-drag-region>
          ChatGPT Next Web
        </div>
        <div className={styles["sidebar-sub-title"]}>For fun via AI.</div>
        <div className={styles["sidebar-logo"] + " no-dark"}>
          <ChatGptIcon />
        </div>
      </div>

      <div className={styles["sidebar-header-bar"]}>
        <IconButton
          icon={<MaskIcon />}
          text={shouldNarrow ? undefined : Locale.Mask.Name}
          className={styles["sidebar-bar-button"]}
          onClick={() => {
            if (config.dontShowMaskSplashScreen !== true) {
              navigate(Path.NewChat, { state: { fromHome: true } });
            } else {
              navigate(Path.Masks, { state: { fromHome: true } });
            }
          }}
          shadow
        />
        <IconButton
          icon={<PluginIcon />}
          text={shouldNarrow ? undefined : Locale.Plugin.Name}
          className={styles["sidebar-bar-button"]}
          onClick={() => navigate(Path.Plugins, { state: { fromHome: true } })}
          shadow
        />
      </div>

      <div
        className={styles["sidebar-body"]}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        <ChatList narrow={shouldNarrow} />
      </div>

      {displayUser && config && (
        <div
          className={styles["sidebar-user"]}
          style={{
            padding: shouldNarrow ? "4px" : "10px 14px",
            justifyContent: shouldNarrow ? "center" : "unset",
            transition: isMobileScreen && isIOSMobile ? "none" : undefined,
          }}
        >
          <Avatar size={24} avatar={config.avatar} />
          {!shouldNarrow &&
            (userStore.isUserLoggedIn() ? (
              <div className={styles["sidebar-user-info"]}>
                <div
                  className={styles["sidebar-user-badge"]}
                  style={{
                    backgroundColor: walletLeft > 0 ? "#2ecc71" : "#e74c3c",
                  }}
                  onClick={() => {
                    getWallet();
                  }}
                >
                  {walletLeft}
                </div>
                <div className={styles["sidebar-user-name"]}>
                  {userStore.user?.email
                    ? truncate(userStore.user.email, 10)
                    : "未登录"}
                </div>
                <div className={styles["sidebar-user-status"]}>
                  <Link to={Path.History}>{Locale.User.History}</Link>
                  <Link to={Path.Redeem}>{Locale.User.RedeemCode}</Link>
                  <Link
                    to="#"
                    onClick={() => {
                      showConfirm(Locale.User.Logout + "?").then((res) => {
                        if (res) {
                          userStore.clearUser();
                          window.location.reload();
                        }
                      });
                    }}
                  >
                    {Locale.User.Logout}
                  </Link>
                </div>
              </div>
            ) : (
              <div className={styles["sidebar-user-info"]}>
                <div className={styles["sidebar-user-name"]}>未登录</div>
                <div className={styles["sidebar-user-status"]}>
                  <Link to={Path.Login}>{Locale.User.Login}</Link>
                </div>
              </div>
            ))}
        </div>
      )}

      <div className={styles["sidebar-tail"]}>
        <div className={styles["sidebar-actions"]}>
          <div className={styles["sidebar-action"] + " " + styles.mobile}>
            <IconButton
              icon={<DeleteIcon />}
              onClick={async () => {
                if (await showConfirm(Locale.Home.DeleteChat)) {
                  chatStore.deleteSession(chatStore.currentSessionIndex);
                }
              }}
            />
          </div>
          <div className={styles["sidebar-action"]}>
            <Link to={Path.Settings}>
              <IconButton icon={<SettingsIcon />} shadow />
            </Link>
          </div>
          <div className={styles["sidebar-action"]}>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <IconButton icon={<GithubIcon />} shadow />
            </a>
          </div>
        </div>
        <div>
          <IconButton
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={() => {
              if (config.dontShowMaskSplashScreen) {
                chatStore.newSession();
                navigate(Path.Chat);
              } else {
                navigate(Path.NewChat);
              }
            }}
            shadow
          />
        </div>
      </div>

      <div
        className={styles["sidebar-drag"]}
        onPointerDown={(e) => onDragStart(e as any)}
      >
        <DragIcon />
      </div>
    </div>
  );
}
