import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, Building2, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";

interface CustomerInfoCardProps {
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    company?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    birth_date?: string;
  };
}

export function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <a href={`mailto:${customer.email}`} className="hover:underline">
            {customer.email}
          </a>
        </div>

        {customer.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${customer.phone}`} className="hover:underline">
              {customer.phone}
            </a>
          </div>
        )}

        {customer.company && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span>{customer.company}</span>
          </div>
        )}

        {(customer.address || customer.city) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              {customer.address && <p>{customer.address}</p>}
              {(customer.city || customer.state || customer.zip_code) && (
                <p className="text-muted-foreground">
                  {customer.city}
                  {customer.state && `, ${customer.state}`}
                  {customer.zip_code && ` - ${customer.zip_code}`}
                </p>
              )}
            </div>
          </div>
        )}

        {customer.birth_date && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>
              Nascimento: {format(new Date(customer.birth_date), 'dd/MM/yyyy')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
