import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Zap } from "lucide-react";
import { useSkills } from "@/hooks/useSkills";
import { useDeleteSkill } from "@/hooks/useDeleteSkill";
import SkillDialog from "@/components/SkillDialog";
import { Skill } from "@/hooks/useSkills";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SkillsSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);

  const { data: skills, isLoading } = useSkills();
  const deleteSkill = useDeleteSkill();

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setDialogOpen(true);
  };

  const handleDelete = (skill: Skill) => {
    setSkillToDelete(skill);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (skillToDelete) {
      deleteSkill.mutate(skillToDelete.id);
      setDeleteDialogOpen(false);
      setSkillToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingSkill(null);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Habilidades dos Agentes</h1>
            <p className="text-muted-foreground">
              Gerencie as skills para roteamento inteligente de conversas
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Habilidade
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Habilidades Cadastradas</CardTitle>
          <CardDescription>
            Lista de todas as habilidades disponíveis no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Carregando habilidades...
                  </TableCell>
                </TableRow>
              ) : skills?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma habilidade cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                skills?.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {skill.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        style={{ 
                          backgroundColor: skill.color,
                          color: 'white'
                        }}
                      >
                        {skill.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(skill)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(skill)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SkillDialog 
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        editSkill={editingSkill}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Habilidade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a habilidade "{skillToDelete?.name}"?
              Esta ação não pode ser desfeita e removerá a skill de todos os agentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
