import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, Building2, MapPin, Calendar, ExternalLink, User } from "lucide-react";
import { displayName, displayInitials } from "@/lib/displayName";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface CustomerInfoCardProps {
  customer: {
    id?: string;
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
    avatar_url?: string;
  };
}

export function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  const fullName = displayName(customer.first_name, customer.last_name);
  const initials = displayInitials(customer.first_name, customer.last_name);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-4 h-4" />
            Cliente
          </CardTitle>
          {customer.id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/contacts/${customer.id}`}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ver Perfil
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Name with Avatar */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <Avatar className="h-12 w-12">
            {customer.avatar_url && <AvatarImage src={customer.avatar_url} alt={fullName} />}
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{fullName || 'Cliente'}</p>
            {customer.company && (
              <p className="text-sm text-muted-foreground">{customer.company}</p>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a href={`mailto:${customer.email}`} className="hover:underline text-primary">
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
        </div>
      </CardContent>
    </Card>
  );
}
