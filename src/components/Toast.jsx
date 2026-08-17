import { useEffect, useState } from "react";

let listeners = [];

export function toast(message) {
  listeners.forEach((fn) => fn(message));
}

export default function ToastHost() {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    const notify = (next) => {
      setMessage(next);
      setShow(true);
      window.setTimeout(() => setShow(false), 2200);
    };
    listeners.push(notify);
    return () => {
      listeners = listeners.filter((fn) => fn !== notify);
    };
  }, []);

  return <div className={`toast${show ? " show" : ""}`}>{message}</div>;
}
