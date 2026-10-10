import { SUPPLIER_VERIFICATION_LABELS, type SupplierVerificationLevel } from '@ws/contracts';
import { Award, Fingerprint, PackageCheck, ShoppingCart } from 'lucide-react';
import { Badge } from './badge';

const ICONS = {
  IDENTITY_VERIFIED: Fingerprint,
  SUPPLIER_TESTED: ShoppingCart,
  QUALITY_TESTED: PackageCheck,
  PARTNER: Award,
} satisfies Record<SupplierVerificationLevel, unknown>;

/**
 * Badge fournisseur explicite (§16, §54) : le libellé dit ce qui a été contrôlé,
 * et la date de dernière vérification est affichée quand elle est connue.
 */
function VerificationBadge({
  level,
  verifiedAt,
  className,
}: {
  level: SupplierVerificationLevel;
  verifiedAt?: Date;
  className?: string;
}) {
  const Icon = ICONS[level];
  const { label, meaning } = SUPPLIER_VERIFICATION_LABELS[level];
  const date = verifiedAt?.toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Badge
      tone={level === 'PARTNER' ? 'gold' : 'verified'}
      title={date ? `${meaning} Dernière vérification : ${date}.` : meaning}
      className={className}
    >
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export { VerificationBadge };
