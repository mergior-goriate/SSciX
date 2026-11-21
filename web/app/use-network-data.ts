"use client";

import { useEffect, useState } from "react";
import { api, message } from "./api-client";

export function useNetworkData<T>(path: string, revision = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setData(undefined);
    api<T>(path).then((result) => {
      if (active) setData(result);
    }).catch((failure) => {
      if (active) setError(failure?.status === 401 ? "Inicie sessão para consultar esta secção." : message(failure));
    });
    return () => { active = false; };
  }, [path, version, revision]);

  return { data, error, refresh: () => setVersion((value) => value + 1) };
}
