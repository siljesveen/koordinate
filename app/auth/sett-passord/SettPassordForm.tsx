"use client";

import { useActionState } from "react";
import { settPassord, type SettPassordState } from "./actions";
import styles from "../../login/page.module.css";

const initialState: SettPassordState = {};

export function SettPassordForm() {
  const [state, formAction, pending] = useActionState(settPassord, initialState);

  return (
    <form className={styles.form} action={formAction}>
      {state.error ? <div className={styles.error}>{state.error}</div> : null}
      <label className={styles.label}>
        Nytt passord
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
      </label>
      <label className={styles.label}>
        Bekreft passord
        <input
          className={styles.input}
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={pending}
        />
      </label>
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Lagrer …" : "Lagre passord og fortsett"}
      </button>
    </form>
  );
}
