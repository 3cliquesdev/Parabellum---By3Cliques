import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Mail, Phone } from "lucide-react";

const mockContacts = [
  {
    id: "1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+1 234 567 8900",
    organization: "Acme Corp",
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Miller",
    email: "sarah@techstart.io",
    phone: "+1 234 567 8901",
    organization: "TechStart",
  },
  {
    id: "3",
    firstName: "Mike",
    lastName: "Johnson",
    email: "mike@innovate.com",
    phone: "+1 234 567 8902",
    organization: "Innovate Inc",
  },
];

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Contacts</h2>
          <p className="text-muted-foreground">Manage your contacts and relationships</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockContacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {contact.firstName} {contact.lastName}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {contact.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {contact.phone}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{contact.organization}</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}