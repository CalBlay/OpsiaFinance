# Vista Gestió — reconstrucció

## Estat actual

**Repartiment parcialment actiu.** Només el node **30 (despeses de gestió)**.

```
Gestió = Directe (SAP + ajustos)
       + repartiment gestió (node 30) si el mes està CONFIRMAT
```

Interruptor: `REPARTIMENT_APLICAT_A_GESTIO = true`  
Nodes actius: `NODES_REPARTIMENT_GESTIO_ACTIUS = [30]` a `lib/repartiment/constants.ts`.

## Flux gestió (node 30)

Els % surten sempre de **Configuració → Repartiment → columna Valor**.

1. **Agenda (LN00000):** apartar `Valor% × gestió SAP Central`
2. **Pool** = resta de Central
3. **LN 02–06:** `SAP propi + Valor% × pool`
4. **Tornar Agenda:** LN00000 queda amb l’objectiu del pas 1 (no residual zero-sum)

## Encara aparcat

- Compres (11)
- Personal SC (17)
- Traspassos a la capa Gestió (segons fase)

## Següent

Validar gestió mes a mes (calcular + confirmar a Dades → Repartiment).  
Després reactivar compres i personal SC.
