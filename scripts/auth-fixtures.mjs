// Formulários sintéticos: nenhum dado capturado de sessões ou contas reais.
export const loginFixtures = [
  {
    name: 'role com texto em inglês e botão criado depois dos campos',
    html: `<input name="email"><input name="pass" type="password">
      <script>
      let scheduled = false;
      document.addEventListener('input', () => {
        if (!scheduled && [...document.querySelectorAll('input')].every(input => input.value) && !document.querySelector('[role=button]')) {
          scheduled = true;
          setTimeout(() => {
            const button = document.createElement('div');
            button.role = 'button'; button.tabIndex = 0; button.innerHTML = '<span>Log</span> <span>In</span>';
            button.onclick = () => { document.body.dataset.submitted = 'yes'; };
            document.body.append(button);
          }, 100);
        }
      });
      </script>`,
    initialSubmitMissing: true,
  },
  {
    name: 'submit nativo sem atributo type e restrito ao formulário correto',
    html: `<button onclick="document.body.dataset.submitted='wrong'">Log in</button>
      <form onsubmit="event.preventDefault();document.body.dataset.submitted='yes'">
        <input name="username"><input name="password" type="password"><button>Sign in</button>
      </form>`,
  },
  {
    name: 'botão desabilitado até preencher e controles ocultos duplicados',
    html: `<div style="visibility:hidden"><input name="email"><input name="pass" type="password"><button type="submit">Entrar</button></div>
      <form onsubmit="event.preventDefault();document.body.dataset.submitted='yes'">
        <input name="email"><input name="pass" type="password"><button type="submit" disabled>Entrar</button>
      </form>
      <script>document.querySelector('form').addEventListener('input', () => {
        if ([...document.querySelectorAll('form input')].every(input => input.value)) document.querySelector('form button').disabled = false;
      });</script>`,
  },
  {
    name: 'texto sem aria-label com espaços e variação regional',
    html: `<input name="email"><input name="pass" type="password">
      <div role="button" tabindex="0" onclick="document.body.dataset.submitted='yes'"><span>  Iniciar   sessão  </span></div>
      <div role="button" tabindex="0" onclick="document.body.dataset.submitted='wrong'">Entrar com o Facebook</div>`,
  },
];
