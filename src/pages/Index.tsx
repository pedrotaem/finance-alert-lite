import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isNative, registerForPush, ReceivedNotification } from '@/lib/push';
import { startBankNotificationListener, isAndroidNative } from '@/lib/notification-listener';
import { Wallet, CreditCard, TrendingDown, Bell, Smartphone } from 'lucide-react';

// Tip: Persist simple state in localStorage for this MVP
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState] as const;
}

export type Transaction = {
  id: string;
  title: string;
  amount: number; // negative for expense, positive for income
  method: 'cartao' | 'pix' | 'outro';
  createdAt: number;
};

function parseNotificationToTx(n: ReceivedNotification): Transaction | null {
  const body = `${n.title ?? ''} ${n.body ?? ''}`.toLowerCase();
  // very naive extraction: R$ or numbers with comma/point
  const amountMatch = body.match(/(?:r\$\s*)?(\d{1,3}(?:[\.,]\d{3})*[\.,]\d{2})/i);
  let amount = 0;
  if (amountMatch) {
    const raw = amountMatch[1].replace(/\./g, '').replace(',', '.');
    amount = parseFloat(raw);
  }
  if (!amount) return null;
  const isPix = body.includes('pix');
  const isCartao = body.includes('cart') || body.includes('credito') || body.includes('débito') || body.includes('debito');
  const title = n.title || (isPix ? 'PIX' : isCartao ? 'Compra no cartão' : 'Transação');
  const sign = body.includes('estornado') || body.includes('receb') ? 1 : -1;
  return {
    id: n.id,
    title,
    amount: sign * amount,
    method: isPix ? 'pix' : isCartao ? 'cartao' : 'outro',
    createdAt: n.receivedAt,
  };
}

const Index = () => {
  const [connected, setConnected] = useLocalStorage<boolean>('push-connected', false);
  const [txs, setTxs] = useLocalStorage<Transaction[]>('transactions', []);
  const [notifEnabled, setNotifEnabled] = useLocalStorage<boolean>('notif-listener-enabled', false);

  const total = useMemo(() => txs.reduce((acc, t) => acc + t.amount, 0), [txs]);
  const monthSpend = useMemo(() => txs.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0), [txs]);

  useEffect(() => {
    if (!connected) return;
    registerForPush((n) => {
      const tx = parseNotificationToTx(n);
      if (tx) setTxs(prev => [tx, ...prev]);
    }).then((res) => {
      if (res.enabled) setConnected(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    if (!notifEnabled || !isAndroidNative()) return;
    let stop: null | (() => Promise<void>) = null;
    startBankNotificationListener((n) => {
      const tx = parseNotificationToTx(n as unknown as ReceivedNotification);
      if (tx) setTxs((prev) => [tx, ...prev]);
    }).then((s) => {
      if (s) stop = s;
    });
    return () => {
      if (stop) stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifEnabled]);

  const connectPush = async () => {
    const res = await registerForPush((n) => {
      const tx = parseNotificationToTx(n);
      if (tx) setTxs(prev => [tx, ...prev]);
    });
    setConnected(!!(res as any).enabled);
  };

  return (
    <div className="min-h-screen">
      <header className="hero-surface">
        <div className="container py-16 md:py-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Gestão Financeira com Notificações
            </h1>
            <p className="text-base md:text-lg opacity-90 mb-6">
              Captura de gastos de cartão e PIX diretamente das notificações do app nativo. Simples, rápido e leve.
            </p>
            <div className="flex items-center gap-3">
              <Button size="lg" onClick={connectPush}>
                <Bell className="mr-2 h-5 w-5" />
                {connected ? 'Reiniciar Push' : isNative() ? 'Conectar Push' : 'Instale no celular'}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setNotifEnabled((v) => !v)}
                disabled={!isAndroidNative()}
              >
                <Smartphone className="mr-2 h-5 w-5" />
                {notifEnabled ? 'Desativar Leitor Android' : 'Ativar Leitor Android'}
              </Button>
              <span className="text-sm opacity-80">
                {isAndroidNative() ? 'Leitor de notificações disponível (Android)' : 'Leitor disponível apenas no Android (app)'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="container -mt-10 md:-mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5"/>Saldo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </CardContent>
            </Card>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5"/>Gasto do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{monthSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </CardContent>
            </Card>
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5"/>Transações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{txs.length}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="container py-10">
          <h2 className="text-xl font-semibold mb-4">Últimas transações</h2>
          {txs.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma transação ainda. {isNative() ? 'Conecte o Push e faça um teste no seu banco.' : 'Instale no celular para habilitar o Push.'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {txs.map((t) => (
                <Card key={t.id} className="card-elevated">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{t.method.toUpperCase()}</Badge>
                      <div className={t.amount < 0 ? 'text-destructive' : 'text-accent'}>
                        {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Index;
