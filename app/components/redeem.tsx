import styles from "./redeem.module.scss";
import Locale from "../locales";
import { IconButton } from "./button";
import { useState } from "react";
import { showConfirm, showToast } from "./ui-lib";
import { useUserConfig } from "../store";

function redeem(code: string) {
  showConfirm(Locale.User.RedeemConfirm).then((res) => {
    if (res) {
      fetch("/api/user/wallet", {
        method: "POST",
        body: JSON.stringify({ code }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + useUserConfig.getState().token,
        },
      }).then(async (res) => {
        if (res.status === 200) {
          showToast(Locale.User.RedeemSuccess);
          window.postMessage(
            {
              type: "chat-input",
            },
            "*",
          );
        } else {
          showToast((await res.json()).message);
        }
      });
    }
  });
}

export function Redeem() {
  const [code, setCode] = useState("");
  return (
    <div className={styles["redeem-page"]}>
      <div className={styles["redeem-title"]}>{Locale.User.RedeemCode}</div>
      <input
        className={styles["redeem-input"]}
        type="text"
        placeholder="Code"
        value={code}
        onChange={(e) => {
          setCode(e.currentTarget.value);
        }}
      />

      <div className={styles["redeem-actions"]}>
        <IconButton
          text={Locale.User.RedeemCode}
          type="primary"
          onClick={() => {
            redeem(code);
          }}
        />
      </div>
    </div>
  );
}
