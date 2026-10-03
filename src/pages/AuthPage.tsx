import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Eye, EyeOff, Send } from 'lucide-react';
import { FocusLogo } from '../components/layout/FocusLogo';
import { Button } from '../components/ui/Button';
import {
  friendlyAuthError,
  consumeAuthCallbackError,
  recoverPassword,
  signIn,
  signInWithDiscord,
  signUp,
  updatePassword,
} from '../services/authService';

export function AuthPage({
  recovery = false,
  onRecovered,
}: {
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(consumeAuthCallbackError);
  const inFlight = useRef(false);
  const loginTab = useRef<HTMLButtonElement>(null);
  const registerTab = useRef<HTMLButtonElement>(null);

  const selectMode = (nextMode: 'login' | 'register' | 'recover') => {
    setMode(nextMode);
    setMessage('');
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextMode = mode === 'login' ? 'register' : 'login';
    selectMode(nextMode);
    (nextMode === 'login' ? loginTab : registerTab).current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage('');
    try {
      if (recovery) {
        await updatePassword(password);
        onRecovered?.();
      } else if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'recover') {
        await recoverPassword(email);
        setMessage('Verifique seu e-mail para continuar.');
      } else {
        const signedIn = await signUp(name, email, password);
        if (!signedIn) setMessage('Verifique seu e-mail para continuar.');
      }
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const handleDiscordLogin = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage('');
    try {
      await signInWithDiscord();
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <main className="auth-screen">
      <div className="auth-layout">
        <section className="auth-intro" aria-label="FocusAcademy">
          <span className="auth-intro-mark">FOCUS TECNOLOGIA</span>
          <h2>FocusAcademy</h2>
          <p>Aprenda construindo projetos reais em equipe.</p>
          <span>Squads, portfólio e histórico profissional verificável em um só lugar.</span>
        </section>
        <div className="auth-panel">
          <FocusLogo />
          <div className="auth-heading">
            <h1>
              {recovery
                ? 'Definir nova senha'
                : mode === 'login'
                  ? 'Entrar na FocusAcademy'
                  : mode === 'register'
                    ? 'Criar conta'
                    : 'Recuperar senha'}
            </h1>
            <p>
              {recovery
                ? 'Escolha uma nova senha para sua conta.'
                : mode === 'login'
                  ? 'Aprenda construindo projetos reais em equipe.'
                  : mode === 'register'
                    ? 'Comece a construir com a comunidade Focus.'
                    : 'Informe seu e-mail para receber o link de recuperação.'}
            </p>
          </div>
          {!recovery && import.meta.env.VITE_DISCORD_AUTH_ENABLED === 'true' && (
            <>
              <Button
                className="auth-discord"
                disabled={pending}
                onClick={handleDiscordLogin}
                variant="primary"
              >
                Continuar com Discord
              </Button>
              <div className="auth-divider">
                <span>ou</span>
              </div>
            </>
          )}
          {!recovery && (
            <div
              className="create-options auth-tabs"
              role="tablist"
              aria-label="Acesso"
              onKeyDown={handleTabKeyDown}
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                aria-controls="auth-form"
                tabIndex={mode === 'login' ? 0 : -1}
                ref={loginTab}
                className={mode === 'login' ? 'active' : ''}
                onClick={() => selectMode('login')}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                aria-controls="auth-form"
                tabIndex={mode === 'register' ? 0 : -1}
                ref={registerTab}
                className={mode === 'register' ? 'active' : ''}
                onClick={() => selectMode('register')}
              >
                Criar conta
              </button>
            </div>
          )}
          <form className="structured-form auth-form" id="auth-form" onSubmit={handleSubmit}>
            {!recovery && mode === 'register' && (
              <label className="field field-wide">
                <span>Nome</span>
                <input
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            {!recovery && (
              <label className="field field-wide">
                <span>E-mail</span>
                <input
                  autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            )}
            {(recovery || mode !== 'recover') && (
              <label className="field field-wide">
                <span>Senha</span>
                <span className="auth-password">
                  <input
                    autoComplete={
                      !recovery && mode === 'login' ? 'current-password' : 'new-password'
                    }
                    type={showPassword ? 'text' : 'password'}
                    minLength={recovery || mode === 'register' ? 8 : 6}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {mode === 'register' && (
                  <small className="field-help">Use ao menos 8 caracteres.</small>
                )}
              </label>
            )}
            <Button disabled={pending} type="submit">
              {pending
                ? 'Aguarde...'
                : recovery
                  ? 'Salvar nova senha'
                  : mode === 'login'
                    ? 'Entrar'
                    : mode === 'register'
                      ? 'Criar conta'
                      : 'Enviar link'}
            </Button>
          </form>
          {!recovery && (
            <div className="auth-links">
              {mode === 'login' ? (
                <button type="button" onClick={() => selectMode('recover')}>
                  Esqueci minha senha
                </button>
              ) : (
                <button type="button" onClick={() => selectMode('login')}>
                  Voltar para entrar
                </button>
              )}
              {mode === 'recover' && <Send size={14} aria-hidden="true" />}
            </div>
          )}
          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
