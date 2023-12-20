import React, { useState, useEffect } from "react";
import styles from "./history.module.scss";
import Locale from "../locales";
import { useUserConfig } from "../store";
import { showToast } from "./ui-lib";

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

export function History() {
  const [historyData, setHistoryData] = useState<
    {
      type: number;
      amount: number;
      createdAt: string;
      description: string;
    }[]
  >([]);
  const [walletLeft, setWalletLeft] = useState(0);
  const [gpt4Rate, setGpt4Rate] = useState(0);
  const [gpt3Rate, setGpt3Rate] = useState(0);
  useEffect(() => {
    getWalletLeft().then(async (res) => {
      if (res.status === 200) {
        res.json().then((res) => {
          setHistoryData(res.list);
          setWalletLeft(res.left);
          setGpt4Rate(res.gpt4_base);
          setGpt3Rate(res.gpt3_base);
        });
      } else {
        showToast((await res.json()).message);
      }
    });
  }, []);

  return (
    <div className={styles.historyPage}>
      <div className={styles.content}>
        <div className={styles.column}>
          <h2>{Locale.Wallet.Left}</h2>
          <p>{walletLeft}</p>
        </div>
        <div className={styles.column}>
          <h2>GPT4 Rate</h2>
          <p>{gpt4Rate}</p>
        </div>
        <div className={styles.column}>
          <h2>GPT3 Rate</h2>
          <p>{gpt3Rate}</p>
        </div>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((item, index) => (
              <tr
                key={index}
                className={item.type === 1 ? styles.recharge : styles.consume}
              >
                <td>{item.type === 1 ? "+" : "-"}</td>
                <td>{item.amount}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
