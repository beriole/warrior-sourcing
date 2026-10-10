import { FapshiProvider } from './fapshi.provider.js';
import { PaymentProviderError, type InitiatePaymentInput } from './payment-provider.js';

/**
 * Adaptateur Fapshi : ce qui part sur le réseau, et ce qui est refusé avant d'y partir.
 *
 * `fetch` est remplacé : aucun appel réseau ne doit sortir d'un test. Ce qui est vérifié
 * ici, c'est le contrat exact envoyé à l'agrégateur — chemin, corps, en-têtes — parce
 * qu'une erreur à cet endroit ne se voit pas en lisant le code appelant.
 */
const CONFIG = {
  baseUrl: 'https://sandbox.fapshi.test/',
  apiUser: 'utilisateur-de-test',
  apiKey: 'cle-de-test',
  webhookSecret: 'secret-de-test',
};

const DEMANDE: InitiatePaymentInput = {
  amountXaf: 45_000,
  phone: '670112233',
  method: 'MTN_MOMO',
  reference: 'PAY-ABCD1234',
  userId: 'compte-1',
  email: 'client@exemple-warrior.cm',
  name: 'Cliente de test',
  message: 'Prestation SRV-ABCD1234',
};

/** Remplace `fetch` et retient ce qui lui a été passé. */
function interceptorReseau(reponse: unknown, statut = 200) {
  const appels: { url: string; init: RequestInit }[] = [];
  const faux = vi.fn(async (url: string | URL, init?: RequestInit) => {
    appels.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(reponse), {
      status: statut,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', faux);
  return appels;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FapshiProvider', () => {
  describe('paiement direct', () => {
    it('appelle /direct-pay avec le numéro, le réseau et notre référence', async () => {
      const appels = interceptorReseau({ transId: 'TRX123', dateInitiated: '2026-10-06T08:00:00.000Z' });
      const provider = new FapshiProvider(CONFIG);

      const resultat = await provider.initiate(DEMANDE);

      expect(appels).toHaveLength(1);
      // L'URL de base porte une barre finale : elle ne doit pas se doubler.
      expect(appels[0]!.url).toBe('https://sandbox.fapshi.test/direct-pay');
      expect(appels[0]!.init.method).toBe('POST');

      const entetes = appels[0]!.init.headers as Record<string, string>;
      expect(entetes.apiuser).toBe('utilisateur-de-test');
      expect(entetes.apikey).toBe('cle-de-test');

      const corps = JSON.parse(String(appels[0]!.init.body)) as Record<string, unknown>;
      expect(corps).toMatchObject({
        amount: 45_000,
        phone: '670112233',
        medium: 'mobile money',
        externalId: 'PAY-ABCD1234',
        userId: 'compte-1',
      });
      // Rien qui relève de la page hébergée ne part sur ce chemin.
      expect(corps.redirectUrl).toBeUndefined();

      expect(resultat.providerRef).toBe('TRX123');
      // Le paiement direct ne produit pas de lien : la validation se fait sur le téléphone.
      expect(resultat.link).toBeNull();
      expect(resultat.initiatedAt.toISOString()).toBe('2026-10-06T08:00:00.000Z');
    });

    it('traduit Orange Money dans le vocabulaire de l’agrégateur', async () => {
      const appels = interceptorReseau({ transId: 'TRX124' });
      await new FapshiProvider(CONFIG).initiate({ ...DEMANDE, method: 'ORANGE_MONEY' });

      const corps = JSON.parse(String(appels[0]!.init.body)) as { medium: string };
      expect(corps.medium).toBe('orange money');
    });

    it('n’envoie pas les champs facultatifs absents', async () => {
      const appels = interceptorReseau({ transId: 'TRX125' });
      await new FapshiProvider(CONFIG).initiate({
        amountXaf: 100,
        phone: '690112233',
        method: 'ORANGE_MONEY',
        reference: 'PAY-MINIMAL',
        userId: 'compte-2',
      });

      const corps = JSON.parse(String(appels[0]!.init.body)) as Record<string, unknown>;
      expect(Object.keys(corps).sort()).toEqual(['amount', 'externalId', 'medium', 'phone', 'userId']);
    });
  });

  describe('refus avant tout appel réseau', () => {
    it('refuse un montant sous le minimum de l’agrégateur', async () => {
      const appels = interceptorReseau({ transId: 'jamais-atteint' });
      const provider = new FapshiProvider(CONFIG);

      await expect(provider.initiate({ ...DEMANDE, amountXaf: 99 })).rejects.toThrow(PaymentProviderError);
      // Rien n'est parti : inutile de faire voyager une demande qu'on sait refusée.
      expect(appels).toHaveLength(0);
    });

    it('refuse un montant non entier', async () => {
      interceptorReseau({ transId: 'jamais-atteint' });
      await expect(
        new FapshiProvider(CONFIG).initiate({ ...DEMANDE, amountXaf: 1_000.5 }),
      ).rejects.toThrow('montant minimum');
    });

    it('refuse un numéro qui n’est pas camerounais', async () => {
      const appels = interceptorReseau({ transId: 'jamais-atteint' });

      await expect(new FapshiProvider(CONFIG).initiate({ ...DEMANDE, phone: '+33612345678' })).rejects.toThrow(
        'numéro camerounais',
      );
      await expect(new FapshiProvider(CONFIG).initiate({ ...DEMANDE, phone: '70011223' })).rejects.toThrow(
        'numéro camerounais',
      );
      expect(appels).toHaveLength(0);
    });

    it('signale un refus de l’agrégateur sans exposer sa réponse brute', async () => {
      interceptorReseau({ message: 'invalid phone number' }, 400);

      await expect(new FapshiProvider(CONFIG).initiate(DEMANDE)).rejects.toThrow(
        'Le service de paiement a refusé la demande.',
      );
    });

    it('signale une réponse sans identifiant de transaction', async () => {
      interceptorReseau({ message: 'Accepted' });

      await expect(new FapshiProvider(CONFIG).initiate(DEMANDE)).rejects.toThrow(
        'identifiant de transaction',
      );
    });
  });

  describe('lecture de l’état', () => {
    it('traduit les états de l’agrégateur vers les nôtres', () => {
      const cas: [string, string][] = [
        ['CREATED', 'INITIATED'],
        ['PENDING', 'PENDING'],
        ['SUCCESSFUL', 'SUCCEEDED'],
        ['FAILED', 'FAILED'],
        ['EXPIRED', 'EXPIRED'],
      ];
      for (const [brut, attendu] of cas) {
        expect(FapshiProvider.toTransaction({ transId: 'T', status: brut }, 'T').status).toBe(attendu);
      }
    });

    it('reste à PENDING sur un état inconnu : on ne conclut pas à la place de l’agrégateur', () => {
      const transaction = FapshiProvider.toTransaction({ transId: 'T', status: 'QUELQUE_CHOSE' }, 'T');
      expect(transaction.status).toBe('PENDING');
      expect(transaction.rawStatus).toBe('QUELQUE_CHOSE');
    });

    it('lit le montant confirmé, qui sert à refuser un écart', () => {
      const transaction = FapshiProvider.toTransaction(
        { transId: 'T', status: 'SUCCESSFUL', amount: 45_000, externalId: 'PAY-ABCD1234' },
        'T',
      );
      expect(transaction.amountXaf).toBe(45_000);
      expect(transaction.externalId).toBe('PAY-ABCD1234');
    });
  });

  describe('webhook', () => {
    it('n’accepte que le secret configuré', () => {
      const provider = new FapshiProvider(CONFIG);
      expect(provider.verifyWebhookSecret('secret-de-test')).toBe(true);
      expect(provider.verifyWebhookSecret('autre-secret')).toBe(false);
      expect(provider.verifyWebhookSecret(undefined)).toBe(false);
    });

    it('refuse tout quand aucun secret n’est configuré', () => {
      const provider = new FapshiProvider({ ...CONFIG, webhookSecret: undefined });
      expect(provider.verifyWebhookSecret('secret-de-test')).toBe(false);
    });

    it('lit l’identifiant de transaction, et rien d’autre', () => {
      const provider = new FapshiProvider(CONFIG);
      expect(provider.webhookProviderRef({ transId: 'TRX1' })).toBe('TRX1');
      expect(provider.webhookProviderRef({ transId: '' })).toBeNull();
      expect(provider.webhookProviderRef({})).toBeNull();
      expect(provider.webhookProviderRef('TRX1')).toBeNull();
      expect(provider.webhookProviderRef(null)).toBeNull();
    });
  });
});
