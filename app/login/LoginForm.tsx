"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import styles from "./page.module.css";

const initialState: LoginState = {};

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="next" value={nextPath} />
      {state.error ? <div className={styles.error}>{state.error}</div> : null}
      <label className={styles.label}>
        E-post
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </label>
      <label className={styles.label}>
        Passord
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Logger inn …" : "Logg inn"}
      </button>
    </form>
  );
}
