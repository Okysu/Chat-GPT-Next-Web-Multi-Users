import React, { useState } from "react";
import styles from "./login.module.scss";
import Locale from "../locales";
import { IconButton } from "./button";
import { useUserConfig } from "../store";
import { useNavigate } from "react-router-dom";
import { showToast } from "./ui-lib";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [lastCodeTime, setLastCodeTime] = useState(0);
  const navigate = useNavigate();
  const login = (email: string, password: string, code: number) => {
    fetch("/api/user/login", {
      method: "POST",
      body: JSON.stringify({ email, password, code }),
    }).then(async (res) => {
      if (res.status === 200) {
        res.json().then((res) => {
          const { token, user } = res;
          const state = {
            token,
            user,
            lastSignTime: new Date().getTime(),
          };
          useUserConfig.setState(state);
          navigate("/");
        });
      } else {
        showToast((await res.json()).message);
      }
    });
  };

  const sendEmail = (email: string) => {
    const regx = /\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*/;
    if (!regx.test(email)) {
      return;
    }
    fetch("/api/user/code", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).then(async (res) => {
      if (res.status === 200) {
        setLastCodeTime(new Date().getTime());
      } else {
        showToast((await res.json()).message);
      }
    });
  };
  return (
    <div className={styles["login-page"]}>
      <div className={styles["login-title"]}>{Locale.User.Login}</div>
      <input
        className={styles["login-input"]}
        type="text"
        placeholder="Email"
        value={email}
        onChange={(e) => {
          setEmail(e.currentTarget.value);
        }}
      />
      <input
        className={styles["login-input"]}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => {
          setPassword(e.currentTarget.value);
        }}
      />
      <input
        className={styles["login-input"]}
        type="text"
        placeholder="Code"
        value={code}
        onChange={(e) => {
          setCode(e.currentTarget.value);
        }}
      />

      <div className={styles["login-actions"]}>
        <IconButton
          text={Locale.User.Login}
          type="primary"
          onClick={login.bind(null, email, password, Number(code))}
        />
        <IconButton
          text={Locale.User.SendCode}
          onClick={sendEmail.bind(null, email)}
          disabled={new Date().getTime() - lastCodeTime < 60 * 1000}
        />
      </div>
    </div>
  );
}
