-- Atualiza links de pagamento Asaas nos planos
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/c/ywto42kmog2unpf6' WHERE slug = 'inicial';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/c/af506r50fefnfdwf' WHERE slug = 'intermediaria';
UPDATE public.planos SET link_pagamento_asaas = 'https://www.asaas.com/c/zz2fvj59p8oy7zpq' WHERE slug = 'profissional';
